"""Turning model output into quantities a person can act on.

Everything else in this package answers "how is the pipeline doing". This
module answers the three questions somebody actually arrives with:

    Is there plastic?   ->  a verdict, not a confidence score
    Where is it?        ->  a named place, not a lat/long
    How much?           ->  square metres and kilometres of coast, not a
                            count of our own detections

Two of the three headline figures need no assumption at all: area afloat comes
straight from the detector's footprint, and coastline affected is counted off
the beached particles. Mass is the exception -- it cannot be derived from
anything we observe -- so it is carried as a stated, adjustable assumption and
labelled as one wherever it appears.
"""
from __future__ import annotations

import numpy as np

from app.core.timebase import label_ist
from app.drift.particles import AFLOAT, BEACHED
from app.geo.coast import (
    HARBOURS, PLACES, dist_km, district, geo, nearest_harbour,
)

# A full-size football pitch, 105 x 68 m. The only purpose is to make an area
# in square metres land for someone who does not think in square metres.
PITCH_M2 = 7140.0

# Each 0.01 deg mask cell is ~1.1 km on a side at this latitude, so the number
# of distinct cells holding beached pellets approximates the length of shoreline
# hit. It is a count of affected shoreline, not a precise survey.
COAST_CELL_KM = 1.1

COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
           "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


def bearing(from_lon: float, from_lat: float, to_lon: float, to_lat: float) -> str:
    """Compass point from one position to another."""
    dx = (to_lon - from_lon) * np.cos(np.radians((from_lat + to_lat) / 2))
    dy = to_lat - from_lat
    deg = (np.degrees(np.arctan2(dx, dy)) + 360) % 360
    return COMPASS[int((deg + 11.25) // 22.5) % 16]


def nearest_place(lon: float, lat: float) -> dict:
    best, bd = None, 1e9
    for p in PLACES:
        d = float(dist_km(lon, lat, p["lon"], p["lat"]))
        if d < bd:
            bd, best = d, p
    return {"name": best["n"], "km": round(bd, 1),
            "bearing": bearing(best["lon"], best["lat"], lon, lat)}


def describe_position(lon: float, lat: float) -> str:
    """'18 km WSW of Kollam' -- what you would say on a radio."""
    p = nearest_place(lon, lat)
    if p["km"] < 2:
        return f"at {p['name']}"
    return f"{p['km']:.0f} km {p['bearing']} of {p['name']}"


def pitches(area_m2: float) -> float:
    return round(area_m2 / PITCH_M2, 1)


def area_phrase(area_m2: float) -> str:
    """A square-metre figure plus something to picture it against."""
    if area_m2 <= 0:
        return "none"
    n = area_m2 / PITCH_M2
    if n < 0.15:
        return f"{round(area_m2):,} m²"
    if n < 1:
        return f"{round(area_m2):,} m² (about {int(round(n * 100))}% of a football pitch)"
    if n < 1.6:
        return f"{round(area_m2):,} m² (about a football pitch)"
    return f"{round(area_m2):,} m² (about {n:.1f} football pitches)"


# ---------------------------------------------------------------- afloat
def plastic_afloat(run, h: int) -> dict:
    """What is still on the water right now, by how sure we are of it."""
    fr = run.frame(h)
    confirmed_area = watching_area = 0.0
    confirmed, watching = [], []
    for i, tid in enumerate(fr.track_ids):
        status = fr.track_status[i]
        if status in ("rejected", "landed"):
            continue
        tr = run.track(tid)
        area = float(tr.area_m2) if tr else 0.0
        m = fr.track_state[i] == AFLOAT
        if not m.any():
            continue
        lon = float(fr.track_x[i][m].mean())
        lat = float(fr.track_y[i][m].mean())
        rec = {
            "id": tid, "area_m2": round(area), "pitches": pitches(area),
            "lon": round(lon, 4), "lat": round(lat, 4),
            "where": describe_position(lon, lat),
            "confidence": round(float(fr.track_conf[i]), 3),
            "nearest_harbour": nearest_harbour(lon, lat)["harbour"]["n"],
        }
        if status == "confirmed":
            confirmed.append(rec)
            confirmed_area += area
        else:
            watching.append(rec)
            watching_area += area

    confirmed.sort(key=lambda r: -r["area_m2"])
    watching.sort(key=lambda r: -r["area_m2"])
    return {
        "confirmed_fields": len(confirmed),
        "confirmed_area_m2": round(confirmed_area),
        "confirmed_pitches": pitches(confirmed_area),
        "confirmed_area_phrase": area_phrase(confirmed_area),
        "watching_fields": len(watching),
        "watching_area_m2": round(watching_area),
        "largest": confirmed[0] if confirmed else (watching[0] if watching else None),
        "fields": confirmed + watching,
    }


# ---------------------------------------------------------------- ashore
def coast_affected(run, h: int) -> dict:
    """How much shoreline has pellets on it, and which districts.

    Counted by snapping beached particles onto the 0.01 deg land-mask grid and
    counting distinct cells, each about 1.1 km of shore.
    """
    g = geo()
    fr = run.frame(h)
    m = fr.nurdle_state == BEACHED
    lons = fr.nurdle_x[m].astype(np.float64)
    lats = fr.nurdle_y[m].astype(np.float64)
    if lons.size == 0:
        return {"km": 0.0, "cells": 0, "districts": [], "km_by_district": {},
                "district_count": 0, "pellets_ashore": 0, "places": [],
                "method": "no pellets ashore yet"}

    i = np.floor((lons - g.bbox[0]) / g.res).astype(np.int64)
    j = np.floor((lats - g.bbox[1]) / g.res).astype(np.int64)
    cells = set(zip(i.tolist(), j.tolist()))

    by_district: dict[str, int] = {}
    cells_by_district: dict[str, set] = {}
    places: dict[str, int] = {}
    for lo, la, ci, cj in zip(lons, lats, i, j):
        d = district(float(lo), float(la))
        by_district[d] = by_district.get(d, 0) + 1
        cells_by_district.setdefault(d, set()).add((int(ci), int(cj)))
        name = nearest_place(float(lo), float(la))["name"]
        places[name] = places.get(name, 0) + 1

    ordered = sorted(by_district.items(), key=lambda kv: -kv[1])
    return {
        "km": round(len(cells) * COAST_CELL_KM, 1),
        "cells": len(cells),
        "districts": [
            {"district": d, "pellets": n,
             "km": round(len(cells_by_district[d]) * COAST_CELL_KM, 1)}
            for d, n in ordered
        ],
        "km_by_district": {d: round(len(c) * COAST_CELL_KM, 1)
                           for d, c in cells_by_district.items()},
        "district_count": len(ordered),
        "pellets_ashore": int(lons.size),
        "places": [p for p, _ in sorted(places.items(), key=lambda kv: -kv[1])[:4]],
        "method": ("distinct 0.01° shoreline cells holding beached pellets, "
                   "about 1.1 km each"),
    }


# ---------------------------------------------------------------- mass
def mass_estimate(run, h: int, assumed_release_tonnes: float) -> dict | None:
    """Pellet mass ashore, scaled from a release figure the operator sets.

    Nothing in the imagery or the drift model constrains how much was spilled,
    so this is arithmetic on an assumption, never a measurement. It returns
    None when no assumption has been set.
    """
    if not assumed_release_tonnes or assumed_release_tonnes <= 0:
        return None
    fr = run.frame(h)
    total = len(fr.nurdle_state)
    if not total:
        return None
    ashore = int((fr.nurdle_state == BEACHED).sum())
    afloat = int((fr.nurdle_state == AFLOAT).sum())
    return {
        "assumed_release_tonnes": assumed_release_tonnes,
        "ashore_tonnes": round(assumed_release_tonnes * ashore / total, 1),
        "afloat_tonnes": round(assumed_release_tonnes * afloat / total, 1),
        "is_assumption": True,
        "note": (f"Scaled from an assumed {assumed_release_tonnes:g} t release. "
                 "No part of the model measures spill mass — change the "
                 "assumption and every tonnage here moves with it."),
    }


# ---------------------------------------------------------------- headline
def headline(run, h: int, assumed_release_tonnes: float = 0.0) -> dict:
    """The one sentence the Overview leads with."""
    afloat = plastic_afloat(run, h)
    coast = coast_affected(run, h)
    fr = run.frame(h)
    rejected = sum(1 for s in fr.track_status if s == "rejected")
    passes_done = run.passes_done(h)

    found = afloat["confirmed_fields"] > 0
    if found:
        verdict = "Plastic confirmed"
        tone = "crit"
    elif afloat["watching_fields"] > 0:
        verdict = "Candidates under watch"
        tone = "warn"
    elif passes_done == 0:
        verdict = "No clear satellite pass yet"
        tone = "neutral"
    else:
        verdict = "Nothing confirmed"
        tone = "ok"

    largest = afloat["largest"]
    parts = []
    if afloat["confirmed_fields"]:
        parts.append(
            f"{afloat['confirmed_fields']} debris "
            f"{'field' if afloat['confirmed_fields'] == 1 else 'fields'} totalling "
            f"{afloat['confirmed_area_m2']:,} m² still afloat"
            + (f", the largest {largest['where']}" if largest else "")
        )
    elif afloat["watching_fields"]:
        parts.append(f"{afloat['watching_fields']} candidate "
                     f"{'patch' if afloat['watching_fields'] == 1 else 'patches'} "
                     "awaiting a second clear look")
    if coast["km"]:
        parts.append(
            f"pellets ashore along about {coast['km']:g} km of coast in "
            f"{coast['district_count']} "
            f"{'district' if coast['district_count'] == 1 else 'districts'}"
        )
    sentence = ("; ".join(parts) + ".") if parts else \
        "Nothing detected yet — the first clear satellite pass is 27 May."

    return {
        "verdict": verdict,
        "tone": tone,
        "found": found,
        "sentence": sentence,
        "as_of": label_ist(h),
        "afloat": afloat,
        "coast": coast,
        "rejected": rejected,
        "mass": mass_estimate(run, h, assumed_release_tonnes),
    }
