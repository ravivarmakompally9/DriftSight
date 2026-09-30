import os
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

# Keep tests off the developer's database and model artefact.
_TMP = tempfile.mkdtemp(prefix="driftsight-test-")
os.environ.setdefault("DRIFTSIGHT_DATABASE_URL", f"sqlite:///{_TMP}/test.db")
os.environ.setdefault("DRIFTSIGHT_MODEL_PATH", f"{_TMP}/detector.joblib")

import pytest  # noqa: E402

from app.detect.model import get_detector  # noqa: E402
from app.scenario.elsa3 import RunParams, run as run_scenario  # noqa: E402


@pytest.fixture(scope="session")
def detector():
    return get_detector()


@pytest.fixture(scope="session")
def default_run(detector):
    """The reference replay: default parameters, default seed."""
    return run_scenario(RunParams(), detector)


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def analyst_headers(client):
    r = client.post("/api/auth/login",
                    json={"email": "analyst@incois.demo", "password": "demo123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
