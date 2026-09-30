from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session, select

from app.api.schemas import MissionCreate, MissionOut, MissionPatch
from app.core.security import User, current_user
from app.db.models import FieldResult, Mission
from app.db.session import get_session

router = APIRouter(tags=["missions"])

LABEL_FOR_RESULT = {"debris_found": "debris_found", "nothing_found": "nothing_found"}


def _out(m: Mission) -> MissionOut:
    return MissionOut(
        id=m.id, run_id=m.run_id, zone_id=m.zone_id, name=m.name, kind=m.kind,
        level=m.level, lon=m.lon, lat=m.lat, hour=m.hour, team=m.team,
        planned_date=m.planned_date, notes=m.notes, status=m.status, result=m.result,
        created_by=m.created_by, created_at=m.created_at.isoformat(),
        updated_at=m.updated_at.isoformat(),
    )


def _visible(q, user: User):
    """Field teams see their own taskings; analysts see the whole board."""
    if user.role == "field":
        return q.where(Mission.team == user.team)
    return q


@router.get("/missions", response_model=list[MissionOut], summary="Mission board")
def list_missions(user: User = Depends(current_user),
                  session: Session = Depends(get_session),
                  run_id: int | None = Query(None)) -> list[MissionOut]:
    q = select(Mission).order_by(Mission.id.desc())
    if run_id is not None:
        q = q.where(Mission.run_id == run_id)
    return [_out(m) for m in session.exec(_visible(q, user)).all()]


@router.post("/missions", response_model=MissionOut, status_code=201,
             summary="Task a zone to a team")
def create_mission(body: MissionCreate, user: User = Depends(current_user),
                   session: Session = Depends(get_session)) -> MissionOut:
    m = Mission(**body.model_dump(), created_by=user.email)
    session.add(m)
    session.commit()
    session.refresh(m)
    return _out(m)


@router.patch("/missions/{mission_id}", response_model=MissionOut,
              summary="Advance a mission or record what the crew found")
def patch_mission(mission_id: int, body: MissionPatch,
                  user: User = Depends(current_user),
                  session: Session = Depends(get_session)) -> MissionOut:
    """`status` moves planned → in_progress → completed. Setting `result` to
    `debris_found` or `nothing_found` files a labelled sample for retraining."""
    m = session.get(Mission, mission_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No mission {mission_id}")
    if user.role == "field" and m.team != user.team:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your team's mission")

    data = body.model_dump(exclude_unset=True)
    new_result = data.get("result")
    for k, v in data.items():
        setattr(m, k, v)
    if new_result and not data.get("status"):
        m.status = "completed"
    m.updated_at = datetime.now(timezone.utc)
    session.add(m)

    if new_result:
        existing = session.exec(
            select(FieldResult).where(FieldResult.mission_id == mission_id)
        ).first()
        if existing:
            existing.label = LABEL_FOR_RESULT[new_result]
            session.add(existing)
        else:
            session.add(FieldResult(
                mission_id=mission_id, run_id=m.run_id, zone_id=m.zone_id,
                label=LABEL_FOR_RESULT[new_result], lon=m.lon, lat=m.lat,
                hour=m.hour, reported_by=user.email, note=m.notes,
            ))
    session.commit()
    session.refresh(m)
    return _out(m)


@router.delete("/missions/{mission_id}", status_code=204, response_class=Response,
               summary="Remove a mission")
def delete_mission(mission_id: int, user: User = Depends(current_user),
                   session: Session = Depends(get_session)) -> Response:
    m = session.get(Mission, mission_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No mission {mission_id}")
    if user.role == "field" and m.team != user.team:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your team's mission")
    for fr in session.exec(select(FieldResult).where(FieldResult.mission_id == mission_id)).all():
        session.delete(fr)
    session.delete(m)
    session.commit()
    return Response(status_code=204)


@router.get("/field-results", summary="Labels collected from the field")
def list_field_results(user: User = Depends(current_user),
                       session: Session = Depends(get_session)) -> dict:
    """Every completed mission adds one labelled sample. These are the ground
    truth a retrained detector would learn from -- the loop that makes the model
    better the longer the system runs."""
    rows = session.exec(select(FieldResult).order_by(FieldResult.id.desc())).all()
    return {
        "count": len(rows),
        "debris_found": sum(1 for r in rows if r.label == "debris_found"),
        "nothing_found": sum(1 for r in rows if r.label == "nothing_found"),
        "pending_training": sum(1 for r in rows if not r.used_for_training),
        "results": [
            {"id": r.id, "mission_id": r.mission_id, "zone_id": r.zone_id,
             "label": r.label, "lon": r.lon, "lat": r.lat, "hour": r.hour,
             "reported_by": r.reported_by, "used_for_training": r.used_for_training,
             "created_at": r.created_at.isoformat()}
            for r in rows
        ],
    }
