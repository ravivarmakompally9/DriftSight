"""Turning tracks and forecasts into a ranked list of places to send people.

Two kinds of zone:
  * sea    -- a tracked patch still floating, scored on confidence, size, how
              close it is to shore, and what is downstream of it
  * coast  -- a stretch of coast the pellet forecast says is about to be hit in
              the next 72 hours

Scores are normalised against the strongest zone in the same snapshot, so HIGH
always means "the most urgent thing right now", not an absolute threshold.
"""
from __future__ import annotations

from app.core.timebase import HOURS, day_label, label_ist
from app.drift.particles import LOST
from app.geo.coast import DISTRICTS, geo, nearest_harbour, sensitivity

LOOKAHEAD_H = 72
LOOKBACK_H = 24
MIN_COAST_SHARE = 0.004
HIGH, MEDIUM, LOW = "HIGH", "MEDIUM", "LOW"

SEA_ACTION = "Boat verification, then boom / skimmer recovery if confirmed."
COAST_ACTION = "Beach survey and manual pellet collection; alert fishing villages."


def _centroid(x, y, state):
    m = state != LOST
    n = int(m.sum())
    if n == 0:
        return None
    return float(x[m].mean()), float(y[m].mean())


def priorities(run, h: int) -> list[dict]:
    g = geo()
    fr = run.frame(h)
    zones: list[dict] = []

    # --- floating patches -------------------------------------------------
    for i, tid in enumerate(fr.track_ids):
        status = fr.track_status[i]
        if status == "rejected":
            continue
        tr = run.track(tid)
        c = _centroid(fr.track_x[i], fr.track_y[i], fr.track_state[i])
        afloat = int((fr.track_state[i] == 0).sum())
        if status == "landed" or c is None or afloat < 5:
            continue
        lon, lat = c
        conf = fr.track_conf[i]
        coast_km = g.coast_distance_km(lon, lat, 40)
        area = (tr.area_m2 if tr else 1000.0) or 1000.0
        score = (conf
                 * min(1.0, area / 2500.0)
                 * (1.0 + 1.0 / (1.0 + coast_km / 10.0))
                 * sensitivity(lon, lat))
        nh = nearest_harbour(lon, lat)
        zones.append({
            "kind": "sea", "id": tid, "name": f"{tid} (at sea)",
            "lon": round(lon, 5), "lat": round(lat, 5),
            "confidence": round(conf, 4), "score": score,
            "coast_km": coast_km, "status": status,
            "area_m2": round(area),
            "window": [int(h), int(min(HOURS, h + 48))],
            "window_label": "next 24–48 h",
            "nearest_harbour": nh["harbour"]["n"], "harbour_km": round(nh["km"], 1),
            "action": SEA_ACTION,
        })

    # --- coast about to be hit -------------------------------------------
    nn = run.metrics["nurdles"]
    for d in DISTRICTS:
        L = run.landfall[d]
        if not L["n"]:
            continue
        soon = sum(1 for x in L["hours"] if h - LOOKBACK_H <= x <= h + LOOKAHEAD_H) / nn
        if soon <= MIN_COAST_SHARE:
            continue
        pt = run.beach_centroids.get(d)
        if not pt:
            continue
        lon, lat = pt["lon"], pt["lat"]
        start = next((x for x in L["hours"] if x >= h - LOOKBACK_H), h)
        end = min(h + LOOKAHEAD_H, L["p50"] if L["p50"] is not None else h + LOOKAHEAD_H)
        nh = nearest_harbour(lon, lat)
        zones.append({
            "kind": "coast", "id": d, "name": f"{d} coast",
            "lon": round(lon, 5), "lat": round(lat, 5),
            "confidence": round(min(0.95, 0.5 + soon * 4), 4),
            "share": round(soon, 5),
            "score": min(1.6, soon * 18) * sensitivity(lon, lat),
            "status": "forecast",
            "window": [int(max(h, start)), int(end)],
            "window_label": f"{label_ist(max(h, start))} → {day_label(end)}",
            "nearest_harbour": nh["harbour"]["n"], "harbour_km": round(nh["km"], 1),
            "action": COAST_ACTION,
        })

    top = max([z["score"] for z in zones], default=1e-6) or 1e-6
    for z in zones:
        z["norm"] = round(z["score"] / top, 4)
        z["score"] = round(z["score"], 4)
        z["level"] = HIGH if z["norm"] >= 0.66 else MEDIUM if z["norm"] >= 0.33 else LOW
    zones.sort(key=lambda z: -z["score"])
    return zones
