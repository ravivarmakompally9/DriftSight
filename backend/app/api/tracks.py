from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import HourQuery, clamp_hour, require_run
from app.api.serialize import track_payload
from app.analysis.backtrack import backtrack

router = APIRouter(tags=["tracks"])


@router.get("/tracks/{track_id}", summary="One tracked patch in full")
def get_track(track_id: str, run_id: str = Query("latest"), h: int | None = HourQuery) -> dict:
    run = require_run(run_id)
    tr = run.track(track_id)
    if tr is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No track {track_id}")
    return track_payload(run, tr, clamp_hour(h), full=True)


@router.post("/tracks/{track_id}/backtrace", summary="Reverse-drift a patch to its source")
def post_backtrace(track_id: str, run_id: str = Query("latest")) -> dict:
    """Runs the drift model backwards from the patch's first sighting and scores
    how closely it passes MSC ELSA 3 in the hours after the sinking."""
    run = require_run(run_id)
    out = backtrack(run, track_id)
    if out is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No track {track_id}")
    out["run_id"] = run.id
    return out
