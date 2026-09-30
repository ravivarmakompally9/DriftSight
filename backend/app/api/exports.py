from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Query, Response
from sqlmodel import Session, select

from app.api.deps import HourQuery, clamp_hour, require_run
from app.analysis.priority import priorities
from app.analysis.report import sitrep, to_markdown, to_pdf
from app.core.security import User, optional_user
from app.core.timebase import at, label_ist
from app.db.models import Mission
from app.db.session import get_session

router = APIRouter(tags=["export"])


def _missions_for(session: Session, user: User | None) -> list[Mission]:
    q = select(Mission).order_by(Mission.id.desc())
    if user and user.role == "field":
        q = q.where(Mission.team == user.team)
    return list(session.exec(q).all())


@router.get("/export/geojson", summary="Priority zones and missions as GeoJSON")
def export_geojson(run_id: str = Query("latest"), h: int | None = HourQuery,
                   user: User | None = Depends(optional_user),
                   session: Session = Depends(get_session)) -> Response:
    """Drops straight into QGIS, Google Earth or a phone GIS app."""
    run = require_run(run_id)
    hh = clamp_hour(h)
    features = []
    for z in priorities(run, hh)[:6]:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(z["lon"], 4), round(z["lat"], 4)]},
            "properties": {
                "kind": "priority_zone", "name": z["name"], "level": z["level"],
                "confidence": round(z["confidence"], 2), "zone_kind": z["kind"],
                "action": z["action"], "nearest_harbour": z["nearest_harbour"],
            },
        })
    for m in _missions_for(session, user):
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(m.lon, 4), round(m.lat, 4)]},
            "properties": {
                "kind": "mission", "name": m.name, "team": m.team,
                "date": m.planned_date, "status": m.status, "level": m.level,
                "result": m.result, "notes": m.notes,
            },
        })
    payload = {
        "type": "FeatureCollection",
        "properties": {
            "incident": "MSC ELSA 3",
            "issued": label_ist(hh),
            "run_id": run.id,
            "source": "DriftSight prototype — simulated imagery and ocean fields",
        },
        "features": features,
    }
    stamp = at(hh).strftime("%Y%m%dT%H%M")
    return Response(
        content=json.dumps(payload, indent=2),
        media_type="application/geo+json",
        headers={"Content-Disposition": f'attachment; filename="driftsight-elsa3-{stamp}.geojson"'},
    )


@router.get("/reports/sitrep", summary="Situation report (JSON, Markdown or PDF)")
def get_sitrep(run_id: str = Query("latest"), h: int | None = HourQuery,
               format: str = Query("json", pattern="^(json|md|pdf)$"),
               user: User | None = Depends(optional_user),
               session: Session = Depends(get_session)):
    run = require_run(run_id)
    hh = clamp_hour(h)
    missions = [{"status": m.status} for m in _missions_for(session, user)]
    rep = sitrep(run, hh, missions)
    if format == "json":
        return rep
    if format == "md":
        return Response(to_markdown(rep), media_type="text/markdown; charset=utf-8")
    stamp = at(hh).strftime("%Y%m%dT%H%M")
    return Response(
        to_pdf(rep),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="driftsight-sitrep-{stamp}.pdf"'},
    )
