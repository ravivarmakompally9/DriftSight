"""Reverse drift: did this patch come from the wreck?

Run the same drift model backwards from a track's first sighting and see how
close the cloud passes to MSC ELSA 3 during the first 30 hours after it sank.
A close pass is evidence the patch is spill debris rather than something that
was already floating there.
"""
from __future__ import annotations

import numpy as np

from app.core.rng import Rng
from app.core.timebase import label_ist
from app.drift.particles import make_set, step
from app.geo.coast import WRECK, dist_km
from app.ocean.providers import FORECAST_PROVIDER

BACKTRACK_SEED = 99
BACKTRACK_PARTICLES = 80
SOURCE_WINDOW_H = 30      # how long after the sinking a match still counts
SCORE_SCALE_KM = 18.0     # e-folding distance of the match score


def backtrack(run, track_id: str) -> dict | None:
    tr = run.track(track_id)
    if tr is None or not tr.detections:
        return None
    d0 = run.detections[tr.detections[0]]

    rng = Rng(BACKTRACK_SEED)
    P = make_set(BACKTRACK_PARTICLES, d0["lon"], d0["lat"], 0.4, 0.010, 0.022, rng)

    path: list[list[float]] = []
    best_km, best_h = 1e9, None
    for h in range(int(d0["h"]), 0, -1):
        step(P, h, FORECAST_PROVIDER, rng, -1, 8.0)
        s = P.stats()
        path.append([round(s["lon"], 5), round(s["lat"], 5), h - 1])
        km = float(dist_km(s["lon"], s["lat"], WRECK["lon"], WRECK["lat"]))
        if h - 1 <= SOURCE_WINDOW_H and km < best_km:
            best_km, best_h = km, h - 1

    score = float(np.exp(-((best_km / SCORE_SCALE_KM) ** 2)))
    return {
        "track": track_id,
        "from_detection": d0["id"],
        "from_hour": int(d0["h"]),
        "path": path,
        "closest_km": round(best_km, 2),
        "closest_hour": best_h,
        "closest_at": label_ist(best_h) if best_h is not None else None,
        "score": round(score, 4),
        "verdict": ("consistent with the MSC ELSA 3 spill" if score > 0.5
                    else "no clear match to the wreck"),
        "wreck": WRECK,
    }
