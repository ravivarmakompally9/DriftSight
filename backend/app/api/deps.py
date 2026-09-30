from __future__ import annotations

from fastapi import HTTPException, Query, status

from app.core.timebase import HOURS
from app.scenario.elsa3 import RunResult
from app.scenario.store import resolve


def require_run(run_id: int | str) -> RunResult:
    r = resolve(run_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No run {run_id}")
    return r


def clamp_hour(h: int | None, default: int | None = None) -> int:
    if h is None:
        h = HOURS if default is None else default
    return max(0, min(int(h), HOURS))


HourQuery = Query(None, ge=0, le=HOURS, description="Replay hour (0 = 25 May 2025 00:00 IST)")
