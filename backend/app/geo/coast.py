"""Coastline, land mask and the place names the console labels.

geo.json is the GSHHS-derived file shipped with the prototype: polygons plus a
0.01 deg packed land mask covering lon 74.8-80.6 E, lat 6.8-11.0 N. It is used
as-is; nothing here regenerates it.
"""
from __future__ import annotations

import base64
import json
from functools import lru_cache
from typing import Iterable

import numpy as np

from app.core.config import settings

D2R = np.pi / 180.0
KM_LAT = 110.95


def km_lon(lat: float | np.ndarray) -> float | np.ndarray:
    return 111.32 * np.cos(np.asarray(lat) * D2R)


def dist_km(lon1, lat1, lon2, lat2):
    """Local flat-earth distance, the same approximation the prototype uses."""
    dx = (np.asarray(lon2) - np.asarray(lon1)) * km_lon((np.asarray(lat1) + np.asarray(lat2)) / 2.0)
    dy = (np.asarray(lat2) - np.asarray(lat1)) * KM_LAT
    return np.hypot(dx, dy)


class Geo:
    """Land mask + coastline polygons, loaded once."""

    def __init__(self, path=None):
        raw = json.loads((path or settings.geo_path).read_text())
        self.bbox = [float(v) for v in raw["bbox"]]
        self.res = float(raw["res"])
        self.nx = int(raw["nx"])
        self.ny = int(raw["ny"])
        self.polys: list[list[list[float]]] = raw["polys"]
        bits = np.unpackbits(np.frombuffer(base64.b64decode(raw["mask"]), dtype=np.uint8))
        self.mask = bits[: self.nx * self.ny].reshape(self.ny, self.nx).astype(bool)

    # ---- land / sea -------------------------------------------------
    def is_land(self, lon, lat):
        lon = np.asarray(lon, dtype=np.float64)
        lat = np.asarray(lat, dtype=np.float64)
        x0, y0, x1, y1 = self.bbox
        inside = (lon >= x0) & (lon < x1) & (lat >= y0) & (lat < y1)
        i = np.clip(np.floor((lon - x0) / self.res).astype(np.int64), 0, self.nx - 1)
        j = np.clip(np.floor((lat - y0) / self.res).astype(np.int64), 0, self.ny - 1)
        out = self.mask[j, i] & inside
        return bool(out) if out.ndim == 0 else out

    def in_box(self, lon, lat):
        x0, y0, x1, y1 = self.bbox
        lon = np.asarray(lon, dtype=np.float64)
        lat = np.asarray(lat, dtype=np.float64)
        out = (lon > x0) & (lon < x1) & (lat > y0) & (lat < y1)
        return bool(out) if out.ndim == 0 else out

    def coast_distance_km(self, lon: float, lat: float, max_km: float = 60.0) -> float:
        """Distance to the nearest land cell, by expanding rings (1 km steps)."""
        if self.is_land(lon, lat):
            return 0.0
        for r in range(1, int(max_km) + 1):
            n = max(12, round(r * 1.5))
            a = 2.0 * np.pi * np.arange(n) / n
            lons = lon + r * np.cos(a) / km_lon(lat)
            lats = lat + r * np.sin(a) / KM_LAT
            if np.any(self.is_land(lons, lats)):
                return float(r)
        return float(max_km)


@lru_cache(maxsize=1)
def geo() -> Geo:
    return Geo()


# ---- named places ---------------------------------------------------
WRECK = {"lon": 76.10, "lat": 9.30, "label": "MSC ELSA 3 (approx. position)"}

PLACES = [
    {"n": "Kochi", "lon": 76.27, "lat": 9.97},
    {"n": "Alappuzha", "lon": 76.33, "lat": 9.49},
    {"n": "Kollam", "lon": 76.59, "lat": 8.89},
    {"n": "Thiruvananthapuram", "lon": 76.95, "lat": 8.50},
    {"n": "Kanyakumari", "lon": 77.54, "lat": 8.08},
    {"n": "Thoothukudi", "lon": 78.13, "lat": 8.80},
    {"n": "Rameswaram", "lon": 79.31, "lat": 9.29},
]

HARBOURS = [
    {"n": "Kochi Port", "lon": 76.26, "lat": 9.96},
    {"n": "Neendakara", "lon": 76.54, "lat": 8.94},
    {"n": "Vizhinjam", "lon": 76.99, "lat": 8.38},
    {"n": "Colachel", "lon": 77.25, "lat": 8.17},
    {"n": "Chinnamuttom", "lon": 77.56, "lat": 8.09},
    {"n": "Thoothukudi", "lon": 78.16, "lat": 8.76},
    {"n": "Pamban", "lon": 79.21, "lat": 9.28},
]

SENSITIVE = [
    {
        "n": "Gulf of Mannar Marine National Park",
        "box": [78.10, 8.72, 79.30, 9.32],
        "w": 1.6,
    }
]

DISTRICTS = [
    "Ernakulam",
    "Alappuzha",
    "Kollam",
    "Thiruvananthapuram",
    "Kanyakumari",
    "Tirunelveli",
    "Thoothukudi",
    "Ramanathapuram",
    "Sri Lanka (Mannar)",
]

REPORTED = {
    "districts": ["Alappuzha", "Kollam", "Thiruvananthapuram", "Kanyakumari", "Ramanathapuram"],
    "kanyakumari_survey_hour": 5 * 24 + 10,
    "note": (
        "Pellets / containers reported ashore (news, INCOIS, Mar. Poll. Bull. 2025 "
        "survey at Kanyakumari on 30 May)."
    ),
}


def district(lon: float, lat: float) -> str:
    """Coarse administrative lookup along the coast, ported from the prototype."""
    if lon < 77.42 and lat > 7.9:
        if lat > 9.75:
            return "Ernakulam"
        if lat > 9.1:
            return "Alappuzha"
        if lat > 8.75:
            return "Kollam"
        if lat > 8.28:
            return "Thiruvananthapuram"
        return "Kanyakumari"
    if lon < 77.75:
        return "Kanyakumari"
    if lon > 79.55:
        return "Sri Lanka (Mannar)"
    if lon < 78.02 and lat < 8.62:
        return "Tirunelveli"
    if lat < 8.98 and lon < 78.35:
        return "Thoothukudi"
    return "Ramanathapuram"


def districts_of(lons: Iterable[float], lats: Iterable[float]) -> list[str]:
    return [district(float(lo), float(la)) for lo, la in zip(lons, lats)]


def sensitivity(lon: float, lat: float) -> float:
    """Weight that lifts the priority of protected water and busy harbours."""
    w = 1.0
    for s in SENSITIVE:
        b = s["box"]
        if b[0] < lon < b[2] and b[1] < lat < b[3]:
            w *= s["w"]
    for hb in HARBOURS:
        if dist_km(lon, lat, hb["lon"], hb["lat"]) < 15:
            w *= 1.2
            break
    return float(w)


def nearest_harbour(lon: float, lat: float) -> dict:
    best, bd = None, 1e9
    for hb in HARBOURS:
        d = float(dist_km(lon, lat, hb["lon"], hb["lat"]))
        if d < bd:
            bd, best = d, hb
    return {"harbour": best, "km": bd}
