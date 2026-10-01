"""Compact JSON shapes for the big payloads.

Coordinates are rounded to 4 decimal places (about 11 m -- finer than the 10 m
pixels the detector works on) and sent as flat arrays rather than GeoJSON
points, which keeps a full 14-day frame well under the 300 KB budget.
"""
from __future__ import annotations

import numpy as np

from app.core.timebase import day_label, iso, label_ist, time_label
from app.analysis.quantify import area_phrase, describe_position, pitches
from app.detect.chips import CHIP
from app.drift.particles import AFLOAT, BEACHED, LOST
from app.scenario.elsa3 import PASSES, SKY_LABEL, sky

COORD_DP = 4


def coords(a: np.ndarray) -> list[float]:
    return np.round(a.astype(np.float64), COORD_DP).tolist()


def centroid(x: np.ndarray, y: np.ndarray, state: np.ndarray):
    m = state != LOST
    if not m.any():
        return None
    return [round(float(x[m].mean()), 5), round(float(y[m].mean()), 5)]


def frame_payload(run, h: int, truth: bool = False) -> dict:
    fr = run.frame(h)
    tracks = []
    for i, tid in enumerate(fr.track_ids):
        tracks.append({
            "id": tid,
            "status": fr.track_status[i],
            "confidence": round(float(fr.track_conf[i]), 4),
            "centroid": centroid(fr.track_x[i], fr.track_y[i], fr.track_state[i]),
            "x": coords(fr.track_x[i]),
            "y": coords(fr.track_y[i]),
            "state": fr.track_state[i].tolist(),
        })
    pellets = {
        "x": coords(fr.nurdle_x),
        "y": coords(fr.nurdle_y),
        "state": fr.nurdle_state.tolist(),
        "ashore": int((fr.nurdle_state == BEACHED).sum()),
        "afloat": int((fr.nurdle_state == AFLOAT).sum()),
        "total": int(len(fr.nurdle_state)),
    }
    out = {
        "run_id": run.id,
        "h": int(fr.h),
        "at": iso(fr.h),
        "as_of": label_ist(fr.h),
        "tracks": tracks,
        "pellets": pellets,
        "state_legend": {"0": "afloat", "1": "ashore", "2": "left-domain", "3": "not-yet-released"},
        "simulated": True,
    }
    if truth:
        out["truth"] = [
            {"id": t["id"], "lon": round(t["lon"], 5), "lat": round(t["lat"], 5),
             "n": t["n"], "sd_km": round(t["sd_km"], 3)}
            for t in fr.truth if t["n"]
        ]
    return out


def detection_payload(run, d: dict, h: int | None = None, full: bool = False) -> dict:
    status = None
    if d.get("track"):
        fr = run.frame(h if h is not None else run.frames[-1].h)
        if d["track"] in fr.track_ids:
            status = fr.track_status[fr.track_ids.index(d["track"])]
    out = {
        "id": d["id"],
        "ref": f"D-{d['id'] + 1:03d}",
        "h": int(d["h"]),
        "at": iso(d["h"]),
        "as_of": label_ist(d["h"]),
        "pass": d["pass"],
        "sensor": d["sensor"],
        "lon": round(d["lon"], 5),
        "lat": round(d["lat"], 5),
        "area_m2": round(d["area_m2"]),
        "pixels": d["px"],
        "score": round(d["q"], 4),
        "fdi": round(d["fdi"], 5),
        "track": d.get("track"),
        "status": status or "watch",
        "where": describe_position(d["lon"], d["lat"]),
        "area_phrase": area_phrase(d["area_m2"]),
        "pitches": pitches(d["area_m2"]),
        "simulated": True,
    }
    if full:
        chip = d["chip"]
        out["chip"] = {
            "size": CHIP,
            "pixel_m": 10,
            "extent_m": CHIP * 10,
            "bands": chip.band_lists(),
            "band_names": ["B2", "B3", "B4", "B6", "B8", "B11"],
            "probability": [round(float(v), 4) for v in chip.prob],
            "classes": [int(v) for v in chip.cls],
            "source": "synthetic",
        }
        out["spectrum"] = _spectrum(chip)
    return out


def _spectrum(chip) -> dict:
    """Mean reflectance of the detected pixels vs the surrounding water."""
    p = chip.prob.astype(np.float64)
    sel = p >= 0.5
    bg = ~sel
    def mean(mask):
        if not mask.any():
            return [0.0] * 6
        return [round(float(chip.bands[b][mask].mean()), 5) for b in range(6)]
    return {"detected": mean(sel), "water": mean(bg)}


def track_payload(run, tr, h: int | None = None, full: bool = False) -> dict:
    hh = run.frames[-1].h if h is None else h
    fr = run.frame(hh)
    idx = fr.track_ids.index(tr.id) if tr.id in fr.track_ids else None
    conf = float(fr.track_conf[idx]) if idx is not None else tr.confidence
    status = fr.track_status[idx] if idx is not None else tr.status
    seen = [i for i in tr.detections if run.detections[i]["h"] <= hh]
    out = {
        "id": tr.id,
        "status": status,
        "confidence": round(conf, 4),
        "born": tr.born,
        "born_at": label_ist(tr.born),
        "area_m2": round(tr.area_m2),
        "score": round(tr.q, 4),
        "sightings": len(seen),
        "detections": seen,
        "landed_hour": tr.landed_hour,
        "centroid": centroid(fr.track_x[idx], fr.track_y[idx], fr.track_state[idx])
        if idx is not None else None,
        "history": [
            {"h": p["h"], "at": iso(p["h"]), "confidence": round(p["confidence"], 4),
             "event": p["event"], "pass": p.get("pass"), "km": round(p["km"], 2) if "km" in p else None}
            for p in tr.history if p["h"] <= hh
        ],
        "forecast_errors": [
            {"h": e["h"], "km": round(e["km"], 2), "spread_km": round(e["spread_km"], 2)}
            for e in tr.errors if e["h"] <= hh
        ],
        "events": [e for e in run.events if e.get("track") == tr.id and e["h"] <= hh],
        "truth": {"real": tr.real, "origin": tr.origin},
    }
    if full and seen:
        out["latest_detection"] = detection_payload(run, run.detections[seen[-1]], hh, full=True)
    return out


def pass_payload(run=None) -> list[dict]:
    out = []
    for p in PASSES:
        s = sky(p)
        out.append({
            "label": p["label"],
            "h": p["h"],
            "at": iso(p["h"]),
            "time_ist": time_label(p["h"]),
            "day": day_label(p["h"]),
            "sensor": p["sensor"],
            "sky": s,
            "sky_label": SKY_LABEL[s],
            "cloud_cells": None if isinstance(p["cloud"], str) else p["cloud"],
            "detections": (sum(1 for d in run.detections if d["h"] == p["h"]) if run else None),
            "simulated": True,
        })
    return out
