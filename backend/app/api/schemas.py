"""Request and response shapes. Everything is documented at /docs."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.core.timebase import HOURS


class LoginRequest(BaseModel):
    email: str = Field(examples=["analyst@incois.demo"])
    password: str = Field(examples=["demo123"])


class UserOut(BaseModel):
    email: str
    name: str
    role: str
    org: str
    initials: str
    team: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class RunCreate(BaseModel):
    """Tracking parameters. Defaults reproduce the reference ELSA 3 replay."""
    gate_km: float = Field(16.0, ge=4, le=40,
                           description="Search radius around the drift forecast, km")
    confirm: float = Field(0.80, ge=0.5, le=0.99,
                           description="Confidence needed to call a patch real debris")
    reject: float = Field(0.25, ge=0.02, le=0.49,
                          description="Below this the patch is dropped as a look-alike")
    cloud_decay: float = Field(0.90, ge=0.5, le=1.0,
                               description="Odds multiplier applied for each clouded pass")
    miss_lr: float = Field(0.25, ge=0.05, le=0.9,
                           description="Odds multiplier when a pass looks and sees nothing")
    nurdles: int = Field(1600, ge=200, le=6000, description="Virtual pellets released")
    particles: int = Field(140, ge=40, le=400, description="Particles per tracked patch")
    seed: int = Field(2025, ge=0, le=2**31 - 1)


class MissionCreate(BaseModel):
    zone_id: str
    name: str
    kind: Literal["sea", "coast"] = "sea"
    level: Literal["HIGH", "MEDIUM", "LOW"] = "MEDIUM"
    lon: float
    lat: float
    hour: int = Field(0, ge=0, le=HOURS)
    team: str = "Indian Coast Guard patrol"
    planned_date: str = ""
    notes: str = ""
    run_id: Optional[int] = None


class MissionPatch(BaseModel):
    status: Optional[Literal["planned", "in_progress", "completed"]] = None
    result: Optional[Literal["debris_found", "nothing_found"]] = None
    team: Optional[str] = None
    planned_date: Optional[str] = None
    notes: Optional[str] = None


class MissionOut(BaseModel):
    id: int
    run_id: Optional[int]
    zone_id: str
    name: str
    kind: str
    level: str
    lon: float
    lat: float
    hour: int
    team: str
    planned_date: str
    notes: str
    status: str
    result: Optional[str]
    created_by: Optional[str]
    created_at: str
    updated_at: str
