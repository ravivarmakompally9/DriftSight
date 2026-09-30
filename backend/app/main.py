"""DriftSight API.

Detect once, track always: an AI detector flags suspected plastic in each
satellite image, every detection seeds a cloud of virtual particles that drifts
with the currents and the wind, and the next clear image either finds the patch
where the model said it would be -- or does not. Real debris gets confirmed,
look-alikes get rejected, and the pellets nobody can see are forecast forward
from the wreck.

Everything in this prototype is simulated: the imagery, the currents and the
winds. No number served by this API is a measurement.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api import auth, detections, exports, incidents, missions, model, ocean, runs, tracks
from app.core.config import settings
from app.core.timebase import HOURS, iso
from app.db.session import init_db

log = logging.getLogger("driftsight")

DESCRIPTION = """
Satellite debris detection, ocean drift tracking and clean-up tasking for the
**MSC ELSA 3** nurdle spill off Kerala, 25 May 2025.

> **Prototype.** Imagery and ocean fields are simulated. Nothing here is a
> measurement. See `GET /api/model` for what is simulated and what would replace
> it with real data.

**Demo accounts** (both `demo123`): `analyst@incois.demo`, `field@coastguard.demo`.

Replay hour 0 is 25 May 2025 00:00 IST; the replay runs 336 hours.
"""

TAGS = [
    {"name": "auth", "description": "Demo sign-in. Two fixed accounts."},
    {"name": "incidents", "description": "The incident, the ship and the satellite passes."},
    {"name": "runs", "description": "Run the 14-day analysis and read it back."},
    {"name": "detections", "description": "What the detector saw, including uploads."},
    {"name": "tracks", "description": "Tracked patches and reverse-drift source tracing."},
    {"name": "missions", "description": "Clean-up tasking and the labels it produces."},
    {"name": "export", "description": "GeoJSON for the field and the situation report."},
    {"name": "model", "description": "Detector metrics and the data-source inventory."},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if settings.train_on_startup:
        from app.detect.model import get_detector
        det = get_detector()
        log.info("detector ready — held-out accuracy %.3f", det.accuracy)
    if settings.run_on_startup:
        from app.scenario.store import latest_run
        r = latest_run()
        if r:
            log.info("default scenario ready — run %s in %d ms: %s",
                     r.id, r.runtime_ms, r.metrics)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=DESCRIPTION,
    openapi_tags=TAGS,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, incidents.router, runs.router, tracks.router,
          detections.router, missions.router, exports.router, model.router,
          ocean.router):
    app.include_router(r, prefix="/api")


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/docs")


@app.get("/api/health", tags=["model"], summary="Liveness and build info")
def health() -> dict:
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.version,
        "t0": iso(0),
        "hours": HOURS,
        "ocean_provider": settings.ocean_provider,
        "simulated": True,
    }
