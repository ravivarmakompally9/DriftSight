"""The MSC ELSA 3 replay.

The Liberian-flagged container ship MSC ELSA 3 listed on 24 May 2025 and sank
on 25 May off the Kerala coast, spilling containers and plastic nurdles that
came ashore from Alappuzha down to Kanyakumari and round to Ramanathapuram.

This module replays those 14 days end to end:

  * hidden truth  -- debris fields released as containers break up. The
    detector never sees these directly; they exist so the demo can score
    itself, and they are only exposed through an explicit ``truth=1`` flag.
  * satellite passes -- eight of them, four usable, at 11:00 IST.
  * detections  -- the classifier run over a synthetic chip at each real field,
    plus the look-alikes (sun glint, foam, an algal raft) that any single-image
    detector picks up alongside them.
  * tracking  -- the Bayesian manager confirms or rejects each candidate.
  * pellets  -- nurdles are far too small to see from space, so they are never
    detected, only forecast forward from the wreck.

Everything here is *simulated*. No satellite imagery and no measured ocean
field is read anywhere in this file.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from app.core.rng import Rng
from app.core.timebase import HOURS
from app.detect.chips import detect_chip, make_chip
from app.detect.model import Detector, get_detector
from app.drift.particles import AFLOAT, BEACHED, HELD, ParticleSet, make_set, step
from app.geo.coast import (
    DISTRICTS, KM_LAT, REPORTED, WRECK, dist_km, district, geo, km_lon,
)
from app.ocean.providers import FORECAST_PROVIDER, TRUTH_PROVIDER
from app.track.tracker import REJECTED, Track, TrackParams, Tracker

SHIP = {
    "name": "MSC ELSA 3",
    "flag": "Liberia",
    "imo": "9123221",
    "route": "Vizhinjam → Kochi",
    "listed": "24 May 2025",
    "sank": "25 May 2025",
    "offshore_nm": 13,
    "containers": 640,
    "hazardous_containers": 13,
    "cargo_of_concern": "~640 containers, 13 hazardous, plastic nurdles",
    "wreck": WRECK,
    "note": "Wreck position is approximate.",
}

# Satellite passes, all at 11:00 IST. `cloud` is "none", "full", or a list of
# [lon, lat, radius_km] cloud cells.
PASSES: list[dict] = [
    {"label": "27 May", "h": 2 * 24 + 11, "sensor": "Sentinel-2", "cloud": "none"},
    {"label": "28 May", "h": 3 * 24 + 11, "sensor": "Landsat 9", "cloud": "full"},
    {"label": "29 May", "h": 4 * 24 + 11, "sensor": "Sentinel-2", "cloud": "full"},
    {"label": "30 May", "h": 5 * 24 + 11, "sensor": "Sentinel-2", "cloud": "none"},
    {"label": "1 Jun", "h": 7 * 24 + 11, "sensor": "Sentinel-2",
     "cloud": [[77.2, 8.2, 45], [76.4, 9.3, 30]]},
    {"label": "2 Jun", "h": 8 * 24 + 11, "sensor": "Landsat 8", "cloud": "full"},
    {"label": "4 Jun", "h": 10 * 24 + 11, "sensor": "Sentinel-2", "cloud": "none"},
    {"label": "6 Jun", "h": 12 * 24 + 11, "sensor": "Sentinel-2", "cloud": [[78.4, 8.6, 50]]},
]

# Hidden truth: three fields released as containers give way over the first day.
TRUTH_FIELDS = [
    {"id": "T1", "release": 3, "n": 70, "windage": (0.024, 0.030), "offset": (0.05, -0.02)},
    {"id": "T2", "release": 9, "n": 65, "windage": (0.008, 0.012), "offset": (-0.03, 0.03)},
    {"id": "T3", "release": 18, "n": 60, "windage": (0.004, 0.008), "offset": (-0.10, 0.00)},
]

NURDLE_WINDAGE = (0.008, 0.020)
NURDLE_RELEASE_HOURS = 12
DIFF_TRUTH, DIFF_TRACK, DIFF_NURDLE = 2.5, 6.0, 20.0


def sky(p: dict) -> str:
    """clear / cloud / partial, from a pass's cloud spec."""
    if not isinstance(p["cloud"], str):
        return "partial"
    return {"full": "cloud", "none": "clear"}[p["cloud"]]


SKY_LABEL = {"clear": "Clear", "cloud": "Clouded", "partial": "Partly cloudy"}


def is_cloudy(p: dict, lon: float, lat: float) -> bool:
    c = p["cloud"]
    if c == "full":
        return True
    if c == "none":
        return False
    return any(float(dist_km(lon, lat, lo, la)) < rk for lo, la, rk in c)


@dataclass
class RunParams:
    gate_km: float = 16.0
    confirm: float = 0.80
    reject: float = 0.25
    cloud_decay: float = 0.90
    miss_lr: float = 0.25
    nurdles: int = 1600
    particles: int = 140
    seed: int = 2025

    def as_dict(self) -> dict:
        return {
            "gate_km": self.gate_km, "confirm": self.confirm, "reject": self.reject,
            "cloud_decay": self.cloud_decay, "miss_lr": self.miss_lr,
            "nurdles": self.nurdles, "particles": self.particles, "seed": self.seed,
        }


@dataclass
class Frame:
    """One hour of the replay, kept as compact arrays."""
    h: int
    track_ids: list[str]
    track_x: list[np.ndarray]
    track_y: list[np.ndarray]
    track_state: list[np.ndarray]
    track_conf: list[float]
    track_status: list[str]
    nurdle_x: np.ndarray
    nurdle_y: np.ndarray
    nurdle_state: np.ndarray
    truth: list[dict]


@dataclass
class RunResult:
    params: RunParams
    frames: list[Frame]
    tracks: list[Track]
    detections: list[dict]
    events: list[dict]
    landfall: dict[str, dict]
    metrics: dict
    detector: Detector
    beach_centroids: dict[str, dict] = field(default_factory=dict)
    id: Optional[int] = None
    created_at: Optional[str] = None
    runtime_ms: int = 0

    def frame(self, h: int) -> Frame:
        return self.frames[max(0, min(int(h), len(self.frames) - 1))]

    def track(self, tid: str) -> Optional[Track]:
        return next((t for t in self.tracks if t.id == tid), None)

    def passes_done(self, h: int) -> int:
        return sum(1 for p in PASSES if p["h"] <= h)


def _centroid_by_district(lons, lats) -> dict[str, dict]:
    acc: dict[str, list] = {}
    for lo, la in zip(lons, lats):
        d = district(float(lo), float(la))
        acc.setdefault(d, [0.0, 0.0, 0])
        acc[d][0] += float(lo)
        acc[d][1] += float(la)
        acc[d][2] += 1
    return {d: {"lon": v[0] / v[2], "lat": v[1] / v[2], "n": v[2]} for d, v in acc.items()}


def run(params: RunParams | None = None, detector: Detector | None = None) -> RunResult:
    """Replay the full 14 days and return everything the console needs."""
    import time

    t_start = time.perf_counter()
    p = params or RunParams()
    det = detector or get_detector()
    g = geo()

    # four independent streams: truth physics, DriftSight's own forecast,
    # the sensor/imagery chain, and the pellet cloud
    r_truth = Rng(p.seed)
    r_fcst = Rng(p.seed + 1)
    r_sense = Rng(p.seed + 2)
    r_nurd = Rng(p.seed + 3)

    truth_sets: list[dict] = [dict(f, particles=None) for f in TRUTH_FIELDS]

    nn = int(p.nurdles)
    nurdles = make_set(nn, WRECK["lon"], WRECK["lat"], 0.6, *NURDLE_WINDAGE, r_nurd)
    nurdles.release = np.floor(r_nurd.raw(nn) * NURDLE_RELEASE_HOURS).astype(np.float32)

    def seed_particles(n: int, lon: float, lat: float) -> ParticleSet:
        return make_set(n, lon, lat, 0.35, 0.004, 0.022, r_fcst)

    tracker = Tracker(
        TrackParams(gate_km=p.gate_km, confirm=p.confirm, reject=p.reject,
                    cloud_decay=p.cloud_decay, miss_lr=p.miss_lr, particles=p.particles),
        seed_particles,
    )

    detections: list[dict] = []
    events: list[dict] = []
    frames: list[Frame] = []
    pass_at = {pp["h"]: pp for pp in PASSES}

    for h in range(HOURS + 1):
        # --- containers give way, releasing a debris field ---------------
        for c in truth_sets:
            if h == c["release"]:
                c["particles"] = make_set(
                    c["n"], WRECK["lon"] + c["offset"][0], WRECK["lat"] + c["offset"][1],
                    0.25, c["windage"][0], c["windage"][1], r_truth)

        sat = pass_at.get(h)
        if sat:
            obs = _observe(sat, truth_sets, r_sense, det, g)
            for o in obs:
                o["id"] = len(detections)
                detections.append(o)
            events += tracker.process_pass(
                h, sat["label"], obs, lambda lo, la, _p=sat: is_cloudy(_p, lo, la))
            if sat["cloud"] == "full":
                events.append({"h": h, "track": None, "kind": "cloud",
                               "text": (f"{sat['label']}: {sat['sensor']} pass fully clouded — "
                                        "tracks advanced by drift model")})

        frames.append(Frame(
            h=h,
            track_ids=[t.id for t in tracker.tracks],
            track_x=[t.particles.x.copy() for t in tracker.tracks],
            track_y=[t.particles.y.copy() for t in tracker.tracks],
            track_state=[t.particles.state.copy() for t in tracker.tracks],
            track_conf=[t.confidence for t in tracker.tracks],
            track_status=[t.status for t in tracker.tracks],
            nurdle_x=nurdles.x.copy(),
            nurdle_y=nurdles.y.copy(),
            nurdle_state=nurdles.state.copy(),
            truth=[dict(c["particles"].stats(), id=c["id"])
                   for c in truth_sets if c["particles"] is not None],
        ))
        if h == HOURS:
            break

        # --- advance one hour --------------------------------------------
        for c in truth_sets:
            if c["particles"] is not None:
                step(c["particles"], h, TRUTH_PROVIDER, r_truth, 1, DIFF_TRUTH)
        for tr in tracker.tracks:
            if tr.status != REJECTED:
                step(tr.particles, h, FORECAST_PROVIDER, r_fcst, 1, DIFF_TRACK)

        # pellets still inside the wreck are parked, not drifting
        held = np.flatnonzero((nurdles.release > h) & (nurdles.state == AFLOAT))
        nurdles.state[held] = HELD
        step(nurdles, h, FORECAST_PROVIDER, r_nurd, 1, DIFF_NURDLE)
        nurdles.state[held] = AFLOAT

        events += tracker.check_landfall(h, district)

    events.sort(key=lambda e: e["h"])

    landfall = _landfall(nurdles, nn)
    beach = _centroid_by_district(
        *_ashore(frames[-1])
    )
    metrics = _metrics(tracker.tracks, detections, landfall, p, nn)
    return RunResult(
        params=p, frames=frames, tracks=tracker.tracks, detections=detections,
        events=events, landfall=landfall, metrics=metrics, detector=det,
        beach_centroids=beach,
        runtime_ms=int((time.perf_counter() - t_start) * 1000),
    )


def _ashore(frame: Frame):
    m = frame.nurdle_state == BEACHED
    return frame.nurdle_x[m], frame.nurdle_y[m]


def _observe(sat: dict, truth_sets: list[dict], rng: Rng, det: Detector, g) -> list[dict]:
    """What the detector reports from one pass: real fields plus look-alikes."""
    obs: list[dict] = []
    if sat["cloud"] == "full":
        return obs

    # --- real debris fields, if they are compact enough and in the clear ---
    for c in truth_sets:
        if c["particles"] is None:
            continue
        s = c["particles"].stats()
        # too few particles left, or spread so thin no sensor would resolve it
        if s["n"] < 12 or s["sd_km"] > 9 or is_cloudy(sat, s["lon"], s["lat"]):
            continue
        glint = 0.4 if rng.next() < 0.3 else 0.0
        chip = make_chip("debris", s["n"] * 55, rng, glint)
        d = detect_chip(chip, det)
        if not d:
            continue
        lon = s["lon"] + rng.gauss1() * 0.15 / float(km_lon(s["lat"]))
        lat = s["lat"] + rng.gauss1() * 0.15 / KM_LAT
        obs.append({**d, "sensor": sat["sensor"], "lon": lon, "lat": lat,
                    "origin": c["id"], "real": True, "chip": chip, "h": sat["h"],
                    "pass": sat["label"], "track": None})

    # --- look-alikes: transient foam lines, glint streaks, a Sargassum raft ---
    first_pass = sat["label"] == "27 May"
    n_false = 2 if first_pass else 1 + (1 if rng.next() < 0.5 else 0)
    ref = obs[0] if obs else {"lon": 76.6, "lat": 8.7}
    for k in range(n_false):
        tries = 0
        while True:
            lo = ref["lon"] + (rng.next() - 0.5) * 0.7
            la = ref["lat"] + (rng.next() - 0.5) * 0.7
            bad = (g.is_land(lo, la)
                   or g.coast_distance_km(lo, la, 8) < 4
                   or any(o["real"] and float(dist_km(lo, la, o["lon"], o["lat"])) < 22 for o in obs))
            if not bad:
                break
            tries += 1
            if tries >= 80:
                break
        if is_cloudy(sat, lo, la):
            continue
        if first_pass and k == 0:
            material = "glint"
        elif rng.next() < 0.55:
            material = "glint"
        else:
            material = "foam" if rng.next() < 0.6 else "algae"
        area = 1500 + rng.next() * 2500
        level = 1.0 if (first_pass and k == 0) else 0.5 + rng.next() * 0.5
        chip = make_chip(material, area, rng, level)
        d = detect_chip(chip, det)
        if not d:
            continue
        obs.append({**d, "sensor": sat["sensor"], "lon": lo, "lat": la,
                    "origin": material, "real": False, "chip": chip, "h": sat["h"],
                    "pass": sat["label"], "track": None})

    # Label the strongest real target first so patch letters read naturally in
    # the console, then the look-alikes, then any remaining real fields.
    reals = [o for o in obs if o["real"]]
    fakes = [o for o in obs if not o["real"]]
    ordered = ([reals.pop(0)] if reals else []) + fakes + reals
    return ordered


def _landfall(nurdles: ParticleSet, nn: int) -> dict[str, dict]:
    out = {d: {"n": 0, "first": None, "hours": [], "share": 0.0, "p10": None, "p50": None}
           for d in DISTRICTS}
    m = nurdles.state == BEACHED
    for lo, la, bh in zip(nurdles.x[m], nurdles.y[m], nurdles.beach_hour[m]):
        rec = out[district(float(lo), float(la))]
        rec["n"] += 1
        rec["hours"].append(float(bh))
    for d in DISTRICTS:
        rec = out[d]
        rec["hours"].sort()
        rec["share"] = rec["n"] / nn if nn else 0.0
        if rec["hours"]:
            rec["first"] = rec["hours"][0]
            rec["p10"] = rec["hours"][int(len(rec["hours"]) * 0.1)]
            rec["p50"] = rec["hours"][int(len(rec["hours"]) * 0.5)]
    return out


def _metrics(tracks: list[Track], detections: list[dict], landfall: dict,
             p: RunParams, nn: int) -> dict:
    confirm = p.confirm
    false_tracks = [t for t in tracks if not t.real]
    real_tracks = [t for t in tracks if t.real]
    errs = [e["km"] for t in tracks for e in t.errors]
    kanya = landfall["Kanyakumari"]
    survey_h = REPORTED["kanyakumari_survey_hour"]
    return {
        "detections_total": len(detections),
        "detections_false": sum(1 for d in detections if not d["real"] and d["q"] >= 0.5),
        "tracks_total": len(tracks),
        "false_tracks": len(false_tracks),
        "false_confirmed": sum(1 for t in false_tracks if t.peak_confidence() >= confirm),
        "real_tracks": len(real_tracks),
        "real_confirmed": sum(1 for t in real_tracks if t.peak_confidence() >= confirm),
        "rejected": sum(1 for t in tracks if t.status == REJECTED),
        "mean_error_km": float(np.mean(errs)) if errs else None,
        "max_error_km": float(np.max(errs)) if errs else None,
        "kanyakumari_first_hour": kanya["first"],
        "kanyakumari_error_days": (None if kanya["first"] is None
                                   else (kanya["first"] - survey_h) / 24.0),
        "reported_districts_hit": sum(1 for d in REPORTED["districts"]
                                      if landfall[d]["share"] >= 0.005),
        "reported_districts_total": len(REPORTED["districts"]),
        "nurdles": nn,
    }
