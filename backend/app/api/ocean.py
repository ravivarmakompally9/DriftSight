from __future__ import annotations

import numpy as np
from fastapi import APIRouter, HTTPException, Query, status

from app.core.timebase import HOURS, iso
from app.geo.coast import geo
from app.ocean.providers import FORECAST_PROVIDER

router = APIRouter(tags=["model"])


@router.get("/currents", summary="Surface current field on a grid")
def get_currents(
    h: int = Query(0, ge=0, le=HOURS, description="Replay hour"),
    bbox: str = Query("74.8,6.8,80.6,11.0", description="lon0,lat0,lon1,lat1"),
    nx: int = Query(22, ge=4, le=60),
    ny: int = Query(22, ge=4, le=60),
) -> dict:
    """The arrow field the operations map draws. Simulated, like everything else
    in this prototype -- swap `SyntheticMonsoonProvider` for `CMEMSProvider` to
    serve a real one from the same endpoint."""
    try:
        x0, y0, x1, y1 = (float(v) for v in bbox.split(","))
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "bbox must be lon0,lat0,lon1,lat1") from exc
    if x1 <= x0 or y1 <= y0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "bbox is empty")

    g = geo()
    lons = np.linspace(x0, x1, nx)
    lats = np.linspace(y0, y1, ny)
    LON, LAT = np.meshgrid(lons, lats)
    u, v = FORECAST_PROVIDER.current(LON.ravel(), LAT.ravel(), float(h))
    sea = ~g.is_land(LON.ravel(), LAT.ravel())

    cells = [
        {"lon": round(float(lo), 4), "lat": round(float(la), 4),
         "u": round(float(uu), 4), "v": round(float(vv), 4)}
        for lo, la, uu, vv, ok in zip(LON.ravel(), LAT.ravel(), u, v, sea) if ok
    ]
    speeds = [float(np.hypot(c["u"], c["v"])) for c in cells]
    return {
        "h": h, "at": iso(h), "bbox": [x0, y0, x1, y1], "nx": nx, "ny": ny,
        "cells": cells,
        "max_speed": round(max(speeds), 4) if speeds else 0.0,
        "units": "m/s, eastward (u) and northward (v)",
        "provider": FORECAST_PROVIDER.name,
        "simulated": True,
    }
