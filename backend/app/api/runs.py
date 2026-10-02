from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import HourQuery, clamp_hour, require_run
from app.api.schemas import RunCreate
from app.api.serialize import detection_payload, frame_payload, track_payload
from app.analysis.forecast import landfall_report, pellet_state
from app.analysis.priority import priorities
from app.analysis.quantify import (
    coast_affected, describe_position, headline, mass_estimate, pitches, plastic_afloat,
)
from app.core.config import settings
from app.core.security import User, optional_user
from app.core.timebase import HOURS, iso, label_ist
from app.scenario.elsa3 import PASSES, RunParams, sky
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
def get_summary(run_id: str, h: int | None = HourQuery,
                tonnes: float = Query(None, ge=0, le=100000,
                                      description="Assumed release mass in tonnes. "
                                                  "Omit to leave mass figures out.")) -> dict:
    """Leads with the answer -- is there plastic, where, how much -- before the
    pipeline counts. Area afloat and coastline affected come straight from the
    model; mass only appears when an assumption is supplied."""
    run = require_run(run_id)
    hh = clamp_hour(h)
    fr = run.frame(hh)
    zones = priorities(run, hh)
    counts = {s: sum(1 for x in fr.track_status if x == s)
              for s in ("confirmed", "watch", "rejected", "landed")}
    dets = [d for d in run.detections if d["h"] <= hh]
    assumed = settings.assumed_release_tonnes if tonnes is None else tonnes

    # A number with no direction of travel is half a number. Detection figures
    # can only move when a satellite looks, so they are compared across the most
    # recent pass; landfall is continuous, so it is compared over 24 hours.
    last_pass = max((p for p in PASSES if p["h"] <= hh), key=lambda p: p["h"], default=None)
    delta = {"at_last_pass": None, "last_24h": None}
    if last_pass is not None and last_pass["h"] >= 1:
        before = plastic_afloat(run, last_pass["h"] - 1)
        now = plastic_afloat(run, hh)
        delta["at_last_pass"] = {
            "label": f"at the {last_pass['label']} pass",
            "plastic_m2": now["confirmed_area_m2"] - before["confirmed_area_m2"],
            "confirmed_fields": now["confirmed_fields"] - before["confirmed_fields"],
        }
    if hh >= 24:
        was = coast_affected(run, hh - 24)
        now_c = coast_affected(run, hh)
        delta["last_24h"] = {
            "label": "in the last 24 h",
            "coast_km": round(now_c["km"] - was["km"], 1),
            "districts": now_c["district_count"] - was["district_count"],
        }

    return {
        "run_id": run.id,
        "delta": delta,
        "h": hh,
        "at": iso(hh),
        "as_of": label_ist(hh),
        "hours": HOURS,
        # --- what a person arrives wanting to know -----------------------
        "headline": headline(run, hh, assumed),
        "plastic": plastic_afloat(run, hh),
        "coast": coast_affected(run, hh),
        # --- how the pipeline is doing -----------------------------------
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
    for r in rows:
        r["where"] = describe_position(r["lon"], r["lat"])
    return {"run_id": run.id, "h": hh, "count": len(rows),
            "total": len(run.detections), "detections": rows}


@router.get("/runs/{run_id}/tracks", summary="All tracked patches in this run")
def get_tracks(run_id: str, h: int | None = HourQuery) -> dict:
    run = require_run(run_id)
    hh = clamp_hour(h)
    rows = [track_payload(run, t, hh, full=True) for t in run.tracks if t.born <= hh]
    for r in rows:
        if r.get("centroid"):
            r["where"] = describe_position(r["centroid"][0], r["centroid"][1])
        r["pitches"] = pitches(r["area_m2"])
    return {"run_id": run.id, "h": hh, "tracks": rows}


@router.get("/runs/{run_id}/forecast", summary="Pellet landfall by district")
def get_forecast(run_id: str, h: int | None = HourQuery,
                 tonnes: float = Query(None, ge=0, le=100000)) -> dict:
    run = require_run(run_id)
    hh = clamp_hour(h)
    out = landfall_report(run)
    out["run_id"] = run.id
    assumed = settings.assumed_release_tonnes if tonnes is None else tonnes
    out["coast"] = coast_affected(run, hh)
    out["coast_at_end"] = coast_affected(run, HOURS)
    out["mass"] = mass_estimate(run, hh, assumed)
    for row in out["districts"]:
        row["coast_km"] = out["coast_at_end"]["km_by_district"].get(row["district"], 0.0)
    return out


@router.get("/runs/{run_id}/priorities", summary="Ranked zones to act on")
def get_priorities(run_id: str, h: int | None = HourQuery) -> dict:
    run = require_run(run_id)
    hh = clamp_hour(h)
    zones = priorities(run, hh)
    for z in zones:
        z["where"] = describe_position(z["lon"], z["lat"])
        if z.get("area_m2"):
            z["pitches"] = pitches(z["area_m2"])
    return {"run_id": run.id, "h": hh, "as_of": label_ist(hh), "zones": zones}


@router.get("/runs/{run_id}/events", summary="Event feed up to an hour")
def get_events(run_id: str,
               until: int | None = Query(None, ge=0, le=HOURS, alias="until"),
               limit: int = Query(200, ge=1, le=1000)) -> dict:
    run = require_run(run_id)
    hh = clamp_hour(until)
    rows = [dict(e, at=iso(e["h"]), as_of=label_ist(e["h"]))
            for e in run.events if e["h"] <= hh]
    return {"run_id": run.id, "until": hh, "count": len(rows), "events": rows[-limit:]}


@router.get("/runs/{run_id}/timeline", summary="Replay timeline as a readable series")
def get_timeline(run_id: str, step: int = Query(3, ge=1, le=24)) -> dict:
    """A scrubber that is only a slider wastes the most informative axis in the
    product. This is the shape of the incident over the 14 days -- how much is
    ashore, how much is still afloat, and what was confirmed when -- so the
    timeline can be read before anybody presses play."""
    run = require_run(run_id)
    total = run.metrics["nurdles"] or 1
    series = []
    for hh in range(0, HOURS + 1, step):
        fr = run.frame(hh)
        ashore = int((fr.nurdle_state == 1).sum())
        afloat = int((fr.nurdle_state == 0).sum())
        plastic = plastic_afloat(run, hh)
        series.append({
            "h": hh,
            "ashore_pct": round(ashore / total * 100, 2),
            "afloat_pct": round(afloat / total * 100, 2),
            "confirmed": sum(1 for s in fr.track_status if s == "confirmed"),
            "coast_km": coast_affected(run, hh)["km"],
            "plastic_m2": plastic["confirmed_area_m2"],
        })
    return {
        "run_id": run.id, "step": step, "hours": HOURS, "series": series,
        "passes": [{"h": p["h"], "label": p["label"], "sky": sky(p),
                    "detections": sum(1 for d in run.detections if d["h"] == p["h"])}
                   for p in PASSES],
    }
