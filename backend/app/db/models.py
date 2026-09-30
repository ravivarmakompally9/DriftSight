"""Persisted state.

The physics is recomputed, not stored -- what needs to survive a restart is the
operational record: which analyses were run, what field teams were tasked with,
and what they actually found when they got there. Those field results are the
labels that would retrain the detector.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """Mirror of the demo accounts, so missions can be owned by a real row."""
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str
    role: str = Field(default="analyst")     # analyst | field
    org: str = ""
    team: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)


class Run(SQLModel, table=True):
    """One execution of the 14-day analysis with a given parameter set."""
    __tablename__ = "runs"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=_now, index=True)
    created_by: Optional[str] = None
    scenario: str = Field(default="elsa3")
    gate_km: float = 16.0
    confirm: float = 0.80
    reject: float = 0.25
    cloud_decay: float = 0.90
    miss_lr: float = 0.25
    nurdles: int = 1600
    seed: int = 2025
    runtime_ms: int = 0
    metrics_json: str = "{}"

    @property
    def metrics(self) -> dict:
        try:
            return json.loads(self.metrics_json)
        except json.JSONDecodeError:
            return {}


class Mission(SQLModel, table=True):
    """A tasking sent to a boat or a beach crew."""
    __tablename__ = "missions"

    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: Optional[int] = Field(default=None, index=True)
    zone_id: str = ""
    name: str = ""
    kind: str = "sea"                        # sea | coast
    level: str = "MEDIUM"                    # HIGH | MEDIUM | LOW
    lon: float = 0.0
    lat: float = 0.0
    hour: int = 0                            # replay hour the zone was taken from
    team: str = ""
    planned_date: str = ""
    notes: str = ""
    status: str = Field(default="planned", index=True)   # planned | in_progress | completed
    result: Optional[str] = None             # debris_found | nothing_found
    created_by: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class FieldResult(SQLModel, table=True):
    """What the crew found. Each row is one training label for the detector."""
    __tablename__ = "field_results"

    id: Optional[int] = Field(default=None, primary_key=True)
    mission_id: int = Field(index=True)
    run_id: Optional[int] = None
    zone_id: str = ""
    label: str = "debris_found"              # debris_found | nothing_found
    lon: float = 0.0
    lat: float = 0.0
    hour: int = 0
    reported_by: Optional[str] = None
    note: str = ""
    used_for_training: bool = False
    created_at: datetime = Field(default_factory=_now)
