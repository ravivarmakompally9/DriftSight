from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import HourQuery, clamp_hour, require_run
from app.api.schemas import RunCreate
from app.api.serialize import detection_payload, frame_payload, track_payload
from app.analysis.forecast import landfall_report, pellet_state
from app.analysis.priority import priorities
from app.core.security import User, optional_user
from app.core.timebase import HOURS, iso, label_ist
from app.scenario.elsa3 import PASSES, RunParams
from app.scenario.store import create_run, latest_run, list_runs

router = APIRouter(tags=["runs"])


def _run_summary_row(r) -> dict:
    return {
        "id": r.id, "created_at": r.created_at.isoformat(), "created_by": r.created_by,
        "runtime_ms": r.runtime_ms, "metrics": r.metrics,
        "params": {"gate_km": r.gate_km, "confirm": r.confirm, "reject": r.reject,
                   "cloud_decay": r.cloud_decay, "miss_lr": r.miss_lr,
                   "nurdles": r.nurdles, "seed": r.seed},
    }


@router.post("/runs", summary="Run the 14-day analysis with a parameter set", status_code=201)
def post_run(body: RunCreate, user: User | None = Depends(optional_user)) -> dict:
    """Replays drift, detection and tracking for the whole incident and stores
    the result. Takes roughly half a second at the default pellet count."""
    params = RunParams(**body.model_dump())
    result = create_run(params, created_by=user.email if user else None)
    return {
        "id": result.id,
        "created_at": result.created_at,
        "runtime_ms": result.runtime_ms,
        "params": params.as_dict(),
        "metrics": result.metrics,
    }


@router.get("/runs", summary="List stored runs")
def get_runs(limit: int = Query(20, ge=1, le=100)) -> list[dict]:
    return [_run_summary_row(r) for r in list_runs(limit)]


@router.get("/runs/latest", summary="The most recent run")
def get_latest() -> dict:
    r = latest_run()
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No runs yet")
    return {"id": r.id, "created_at": r.created_at, "runtime_ms": r.runtime_ms,
            "params": r.params.as_dict(), "metrics": r.metrics,
            "hours": HOURS, "t0": iso(0)}


@router.get("/runs/{run_id}/summary", summary="Headline KPIs at a point in the replay")
def get_summary(run_id: str, h: int | None = HourQuery) -> dict:
    run = require_run(run_id)
    hh = clamp_hour(h)
    fr = run.frame(hh)
    zones = priorities(run, hh)
    counts = {s: sum(1 for x in fr.track_status if x == s)
              for s in ("confirmed", "watch", "rejected", "landed")}
    dets = [d for d in run.detections if d["h"] <= hh]
    return {
        "run_id": run.id,
        "h": hh,
        "at": iso(hh),
        "as_of": label_ist(hh),
        "hours": HOURS,
        "detections": len(dets),
        "detections_total": len(run.detections),
        "passes_done": run.passes_done(hh),
        "passes_total": len(PASSES),
        "confirmed": counts["confirmed"],
        "watching": counts["watch"],
        "rejected": counts["rejected"],
        "landed": counts["landed"],
        "pellets": pellet_state(run, hh),
        "high_priority": sum(1 for z in zones if z["level"] == "HIGH"),
        "top_zones": zones[:5],
        "metrics": run.metrics,
        "params": run.params.as_dict(),
        "simulated": True,
    }


@router.get("/runs/{run_id}/frame/{h}", summary="Particle positions for one hour")
def get_frame(run_id: str, h: int, truth: int = Query(0, ge=0, le=1,
              description="1 also returns the hidden truth fields (demo only)")) -> dict:
    """Compact packed arrays: track particles with status and confidence, pellet
    positions with state, and optionally the hidden truth the detector never sees."""
    run = require_run(run_id)
    return frame_payload(run, clamp_hour(h), truth=bool(truth))


@router.get("/runs/{run_id}/detections", summary="All AI detections in this run")
def get_detections(run_id: str, h: int | None = HourQuery) -> dict:
    run = require_run(run_id)
    hh = clamp_hour(h)
    rows = [detection_payload(run, d, hh) for d in run.detections if d["h"] <= hh]
    return {"run_id": run.id, "h": hh, "count": len(rows),
            "total": len(run.detections), "detections": rows}


@router.get("/runs/{run_id}/tracks", summary="All tracked patches in this run")
def get_tracks(run_id: str, h: int | None = HourQuery) -> dict:
    run = require_run(run_id)
    hh = clamp_hour(h)
    rows = [track_payload(run, t, hh, full=True) for t in run.tracks if t.born <= hh]
    return {"run_id": run.id, "h": hh, "tracks": rows}


@router.get("/runs/{run_id}/forecast", summary="Pellet landfall by district")
def get_forecast(run_id: str) -> dict:
    run = require_run(run_id)
    out = landfall_report(run)
    out["run_id"] = run.id
    return out


@router.get("/runs/{run_id}/priorities", summary="Ranked zones to act on")
def get_priorities(run_id: str, h: int | None = HourQuery) -> dict:
    run = require_run(run_id)
    hh = clamp_hour(h)
    return {"run_id": run.id, "h": hh, "as_of": label_ist(hh), "zones": priorities(run, hh)}


@router.get("/runs/{run_id}/events", summary="Event feed up to an hour")
def get_events(run_id: str,
               until: int | None = Query(None, ge=0, le=HOURS, alias="until"),
               limit: int = Query(200, ge=1, le=1000)) -> dict:
    run = require_run(run_id)
    hh = clamp_hour(until)
    rows = [dict(e, at=iso(e["h"]), as_of=label_ist(e["h"]))
            for e in run.events if e["h"] <= hh]
    return {"run_id": run.id, "until": hh, "count": len(rows), "events": rows[-limit:]}
