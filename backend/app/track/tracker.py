"""Bayesian track manager -- the "track always" half of DriftSight.

Each detection seeds a particle cloud. At the next pass the cloud has drifted to
a predicted position with a predicted spread; whatever the detector reports is
associated to the nearest prediction inside a gate, and the track's odds of
being real floating debris move accordingly:

    re-found near the forecast   ->  strong evidence up, scaled by how good the
                                     detection was and how close it landed
    nothing there                ->  evidence down (likelihood ratio 0.25)
    under cloud                  ->  almost no evidence either way (0.9), the
                                     drift model just keeps predicting

Confidence crossing ``confirm`` marks real debris; dropping under ``reject``
marks a look-alike and stops the track. That is what keeps foam and sun glint
off a boat's tasking sheet.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Iterable, Optional

import numpy as np

from app.drift.particles import ParticleSet
from app.geo.coast import dist_km

CONFIRMED, WATCH, REJECTED, LANDED = "confirmed", "watch", "rejected", "landed"

MATCH_GAIN = 4.0      # multiplier on the detection-quality odds ratio
MISS_LR = 0.25        # likelihood ratio for "looked, saw nothing"
CLOUD_LR = 0.9        # likelihood ratio for "could not look"


@dataclass
class TrackParams:
    gate_km: float = 16.0
    confirm: float = 0.80
    reject: float = 0.25
    cloud_decay: float = CLOUD_LR
    miss_lr: float = MISS_LR
    particles: int = 140


@dataclass
class Track:
    id: str
    particles: ParticleSet
    confidence: float
    status: str
    born: int
    detections: list[int] = field(default_factory=list)
    history: list[dict] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)
    area_m2: float = 0.0
    q: float = 0.0
    origin: str = ""
    real: bool = False
    landed_hour: Optional[int] = None

    @property
    def active(self) -> bool:
        return self.status not in (REJECTED, LANDED)

    def peak_confidence(self) -> float:
        return max([h["confidence"] for h in self.history], default=self.confidence)


def _pct(p: float) -> str:
    return f"{round(p * 100)}%"


class Tracker:
    """Holds the live tracks and applies one satellite pass at a time."""

    def __init__(self, params: TrackParams, seed_particles: Callable[[int, float, float], ParticleSet]):
        self.params = params
        self.tracks: list[Track] = []
        self._letter = 0
        self._seed = seed_particles

    # ---- confidence ---------------------------------------------------
    def _update(self, tr: Track, likelihood_ratio: float) -> None:
        odds = tr.confidence / (1.0 - tr.confidence) * likelihood_ratio
        tr.confidence = min(0.99, max(0.01, odds / (1.0 + odds)))

    def _set_status(self, tr: Track, hour: int, events: list[dict], label: str) -> None:
        prev = tr.status
        p = self.params
        if tr.confidence >= p.confirm:
            tr.status = CONFIRMED
        elif tr.confidence < p.reject:
            tr.status = REJECTED
        else:
            tr.status = WATCH
        if prev != tr.status and tr.status != WATCH:
            verdict = "CONFIRMED as real debris" if tr.status == CONFIRMED else "REJECTED as a look-alike"
            events.append({"h": hour, "track": tr.id, "kind": tr.status,
                           "text": f"{label}: {tr.id} {verdict}"})

    # ---- one pass -------------------------------------------------------
    def process_pass(self, hour: int, label: str, observations: list[dict],
                     is_cloudy: Callable[[float, float], bool]) -> list[dict]:
        """Associate this pass's detections to the live tracks and update them.

        ``observations`` are dicts with at least ``id``, ``lon``, ``lat``, ``q``,
        ``area_m2``, ``origin`` and ``real``; each gets a ``track`` key written
        back when it is consumed.
        """
        events: list[dict] = []
        p = self.params
        live: list[dict] = []

        for tr in self.tracks:
            if tr.status in (REJECTED, LANDED):
                continue
            s = tr.particles.stats()
            if s["n"] == 0:
                continue
            if is_cloudy(s["lon"], s["lat"]):
                self._update(tr, p.cloud_decay)
                tr.history.append({"h": hour, "confidence": tr.confidence, "event": "cloud", "pass": label})
                events.append({"h": hour, "track": tr.id, "kind": "cloud",
                               "text": f"{label}: cloud over {tr.id} — kept predicting"})
                continue
            # gate: never tighter than the configured radius, never tighter than
            # the forecast's own 3-sigma uncertainty
            live.append({"track": tr, "stats": s, "gate": max(p.gate_km, 3.0 * s["sd_km"])})

        # global nearest-first association
        pairs = []
        for L in live:
            for o in observations:
                d = float(dist_km(L["stats"]["lon"], L["stats"]["lat"], o["lon"], o["lat"]))
                if d < L["gate"]:
                    pairs.append((d, L, o))
        pairs.sort(key=lambda t: t[0])
        used: set[int] = set()
        matched: dict[str, tuple] = {}
        for d, L, o in pairs:
            if o["id"] in used or L["track"].id in matched:
                continue
            used.add(o["id"])
            matched[L["track"].id] = (d, o)

        for L in live:
            tr = L["track"]
            before = tr.confidence
            got = matched.get(tr.id)
            if got:
                d, o = got
                lr = MATCH_GAIN * np.sqrt(o["q"] / (1.0 - o["q"])) * np.exp(-((d / L["gate"]) ** 2))
                self._update(tr, float(lr))
                tr.errors.append({"h": hour, "km": d, "spread_km": L["stats"]["sd_km"]})
                tr.particles = self._seed(len(tr.particles), o["lon"], o["lat"])
                tr.detections.append(o["id"])
                o["track"] = tr.id
                tr.area_m2 = o["area_m2"]
                tr.q = o["q"]
                tr.history.append({"h": hour, "confidence": tr.confidence, "event": "match",
                                   "km": d, "pass": label})
                events.append({"h": hour, "track": tr.id, "kind": "match",
                               "text": (f"{label}: {tr.id} re-found {d:.1f} km from forecast — "
                                        f"confidence {_pct(before)} → {_pct(tr.confidence)}")})
            else:
                self._update(tr, p.miss_lr)
                tr.history.append({"h": hour, "confidence": tr.confidence, "event": "miss", "pass": label})
                events.append({"h": hour, "track": tr.id, "kind": "miss",
                               "text": (f"{label}: {tr.id} not where the currents put it — "
                                        f"confidence {_pct(before)} → {_pct(tr.confidence)}")})
            self._set_status(tr, hour, events, label)

        # anything left over starts a new track
        for o in observations:
            if o["id"] in used:
                continue
            tid = f"Patch {chr(65 + self._letter)}"
            self._letter += 1
            conf = 0.2 + 0.5 * o["q"]
            tr = Track(
                id=tid,
                particles=self._seed(p.particles, o["lon"], o["lat"]),
                confidence=conf,
                status=WATCH,
                born=hour,
                detections=[o["id"]],
                history=[{"h": hour, "confidence": conf, "event": "new", "pass": label}],
                area_m2=o["area_m2"],
                q=o["q"],
                origin=o.get("origin", ""),
                real=bool(o.get("real", False)),
            )
            o["track"] = tid
            self.tracks.append(tr)
            events.append({"h": hour, "track": tid, "kind": "new",
                           "text": (f"{label}: AI flags {tid} ({_pct(o['q'])} plastic-like, "
                                    f"{round(o['area_m2'])} m²)")})
            self._set_status(tr, hour, events, label)
        return events

    # ---- beaching ---------------------------------------------------
    def check_landfall(self, hour: int, district_of: Callable[[float, float], str]) -> list[dict]:
        """A track whose cloud is mostly ashore stops being a sea target."""
        events = []
        for tr in self.tracks:
            if tr.status in (REJECTED, LANDED):
                continue
            s = tr.particles.stats()
            if s["beached"] > 0.7 * len(tr.particles):
                tr.status = LANDED
                tr.landed_hour = hour + 1
                lon = s["lon"] if s["n"] else float(tr.particles.x[0])
                lat = s["lat"] if s["n"] else float(tr.particles.y[0])
                events.append({"h": hour + 1, "track": tr.id, "kind": "landed",
                               "text": f"{tr.id} came ashore near {district_of(lon, lat)}"})
        return events

    def active_tracks(self) -> Iterable[Track]:
        return (t for t in self.tracks if t.status != REJECTED)
