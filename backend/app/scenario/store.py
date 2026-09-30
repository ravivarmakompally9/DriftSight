"""In-memory cache of completed runs.

A full replay is ~340 frames of particle positions -- cheap to recompute
(under half a second) but not something to serialise into SQLite on every
request. The database keeps the run's identity, parameters and headline
metrics; this keeps the arrays alongside it for as long as they are useful.
"""
from __future__ import annotations

import json
import threading
from collections import OrderedDict
from datetime import timezone
from typing import Optional

from sqlmodel import Session, select

from app.core.config import settings
from app.db.models import Run
from app.db.session import engine
from app.scenario.elsa3 import RunParams, RunResult, run as run_scenario

_LOCK = threading.RLock()
_CACHE: "OrderedDict[int, RunResult]" = OrderedDict()
_LATEST: Optional[int] = None


def _remember(run_id: int, result: RunResult) -> None:
    with _LOCK:
        _CACHE[run_id] = result
        _CACHE.move_to_end(run_id)
        while len(_CACHE) > settings.max_cached_runs:
            _CACHE.popitem(last=False)


def create_run(params: RunParams, created_by: str | None = None) -> RunResult:
    result = run_scenario(params)
    with Session(engine) as s:
        row = Run(
            created_by=created_by,
            gate_km=params.gate_km, confirm=params.confirm, reject=params.reject,
            cloud_decay=params.cloud_decay, miss_lr=params.miss_lr,
            nurdles=params.nurdles, seed=params.seed,
            runtime_ms=result.runtime_ms,
            metrics_json=json.dumps(result.metrics),
        )
        s.add(row)
        s.commit()
        s.refresh(row)
        run_id = int(row.id)
        created = row.created_at
    result.id = run_id
    result.created_at = created.replace(tzinfo=timezone.utc).isoformat()
    _remember(run_id, result)
    global _LATEST
    with _LOCK:
        _LATEST = run_id
    return result


def get_run(run_id: int) -> Optional[RunResult]:
    """Return a cached run, rebuilding it from its stored parameters if evicted."""
    with _LOCK:
        if run_id in _CACHE:
            _CACHE.move_to_end(run_id)
            return _CACHE[run_id]
    with Session(engine) as s:
        row = s.get(Run, run_id)
    if row is None:
        return None
    params = RunParams(gate_km=row.gate_km, confirm=row.confirm, reject=row.reject,
                       cloud_decay=row.cloud_decay, miss_lr=row.miss_lr,
                       nurdles=row.nurdles, seed=row.seed)
    result = run_scenario(params)
    result.id = run_id
    result.created_at = row.created_at.replace(tzinfo=timezone.utc).isoformat()
    _remember(run_id, result)
    return result


def latest_run(create_if_missing: bool = True) -> Optional[RunResult]:
    with _LOCK:
        if _LATEST is not None and _LATEST in _CACHE:
            return _CACHE[_LATEST]
    with Session(engine) as s:
        row = s.exec(select(Run).order_by(Run.id.desc())).first()
    if row is not None:
        return get_run(int(row.id))
    if create_if_missing:
        return create_run(RunParams())
    return None


def list_runs(limit: int = 20) -> list[Run]:
    with Session(engine) as s:
        return list(s.exec(select(Run).order_by(Run.id.desc()).limit(limit)).all())


def resolve(run_id: int | str | None) -> Optional[RunResult]:
    """Accept an id or the string 'latest'."""
    if run_id in (None, "latest"):
        return latest_run()
    try:
        return get_run(int(run_id))
    except (TypeError, ValueError):
        return None
