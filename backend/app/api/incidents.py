from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.serialize import pass_payload
from app.core.timebase import HOURS, iso
from app.geo.coast import (
    DISTRICTS, HARBOURS, PLACES, REPORTED, SENSITIVE, WRECK, geo,
)
from app.scenario.elsa3 import SHIP
from app.scenario.store import latest_run

router = APIRouter(tags=["incidents"])

ELSA3 = {
    "id": "elsa3",
    "name": "MSC ELSA 3 · Kerala",
    "short": "MSC ELSA 3",
    "subtitle": "Container ship sank 25 May 2025 · nurdle spill",
    "status": "active",
    "ship": SHIP,
    "t0": iso(0),
    "t0_label": "25 May 2025 00:00 IST",
    "hours": HOURS,
    "reported": {
        "districts": REPORTED["districts"],
        "kanyakumari_survey_hour": REPORTED["kanyakumari_survey_hour"],
        "kanyakumari_survey": "30 May 2025 — beach survey rated pellet pollution “Very High”",
        "note": REPORTED["note"],
    },
    "simulated": True,
    "disclaimer": (
        "Prototype. The satellite imagery and ocean fields in this incident are "
        "simulated; nothing shown is a measurement."
    ),
}


@router.get("/incidents", summary="Incidents DriftSight is watching")
def get_incidents() -> list[dict]:
    return [{k: ELSA3[k] for k in ("id", "name", "short", "subtitle", "status", "t0", "hours", "simulated")}]


@router.get("/incidents/{incident_id}", summary="One incident in full")
def get_incident(incident_id: str) -> dict:
    if incident_id != "elsa3":
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No incident {incident_id}")
    run = latest_run(create_if_missing=False)
    return {
        **ELSA3,
        "passes": pass_payload(run),
        "latest_run": run.id if run else None,
    }


@router.get("/passes", summary="Satellite pass schedule")
def get_passes() -> list[dict]:
    return pass_payload(latest_run(create_if_missing=False))


@router.get("/geo", summary="Coastline, harbours, places and protected water")
def get_geo() -> dict:
    """The static map furniture. The land mask itself stays server-side; the
    client only needs the polygons to draw."""
    g = geo()
    return {
        "bbox": g.bbox,
        "coastline": {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "properties": {"kind": "land", "index": i},
                 "geometry": {"type": "Polygon", "coordinates": [poly]}}
                for i, poly in enumerate(g.polys)
            ],
        },
        "places": PLACES,
        "harbours": HARBOURS,
        "protected": SENSITIVE,
        "districts": DISTRICTS,
        "wreck": WRECK,
    }
