import json

from app.core.timebase import HOURS


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["simulated"] is True


def test_openapi_documents_everything(client):
    spec = client.get("/openapi.json").json()
    for path in ("/api/runs", "/api/runs/latest", "/api/incidents",
                 "/api/incidents/{incident_id}", "/api/runs/{run_id}/summary",
                 "/api/runs/{run_id}/frame/{h}", "/api/tracks/{track_id}/backtrace",
                 "/api/missions", "/api/model", "/api/passes",
                 "/api/export/geojson", "/api/reports/sitrep", "/api/detect/upload"):
        assert path in spec["paths"], path
    assert client.get("/api/incidents/elsa3").status_code == 200


def test_login_and_me(client):
    bad = client.post("/api/auth/login", json={"email": "analyst@incois.demo", "password": "nope"})
    assert bad.status_code == 401
    r = client.post("/api/auth/login", json={"email": "analyst@incois.demo", "password": "demo123"})
    assert r.status_code == 200
    tok = r.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok}"})
    assert me.json()["role"] == "analyst"


def test_incident_summary(client):
    r = client.get("/api/incidents/elsa3").json()
    assert r["ship"]["name"] == "MSC ELSA 3"
    assert r["reported"]["districts"]
    assert len(r["passes"]) == 8
    assert r["simulated"] is True


def test_latest_run_and_summary(client):
    latest = client.get("/api/runs/latest").json()
    assert latest["metrics"]["real_confirmed"] == 2
    s = client.get(f"/api/runs/{latest['id']}/summary", params={"h": 336}).json()
    assert s["confirmed"] >= 1
    assert s["rejected"] == 2
    assert 0 <= s["pellets"]["ashore_pct"] <= 100


def test_frame_is_small_enough_to_stream(client):
    r = client.get("/api/runs/latest/frame/200")
    assert r.status_code == 200
    assert len(r.content) < 300 * 1024, "frames must stay under the 300 KB budget"
    body = r.json()
    assert len(body["pellets"]["x"]) == len(body["pellets"]["state"])


def test_frame_hides_truth_unless_asked(client):
    assert "truth" not in client.get("/api/runs/latest/frame/200").json()
    assert "truth" in client.get("/api/runs/latest/frame/200", params={"truth": 1}).json()


def test_detection_detail_carries_the_chip(client):
    d = client.get("/api/detections/0").json()
    assert len(d["chip"]["bands"]) == 6
    assert len(d["chip"]["probability"]) == 24 * 24
    assert len(d["spectrum"]["detected"]) == 6


def test_track_detail_and_backtrace(client):
    t = client.get("/api/tracks/Patch A").json()
    assert t["history"]
    bt = client.post("/api/tracks/Patch A/backtrace").json()
    assert bt["score"] > 0.5
    assert bt["path"]


def test_unknown_track_is_404(client):
    assert client.get("/api/tracks/Patch Z").status_code == 404


def test_forecast_and_priorities(client):
    f = client.get("/api/runs/latest/forecast").json()
    assert any(d["district"] == "Kanyakumari" for d in f["districts"])
    assert f["validation"]["ahead_of_report"] is True
    z = client.get("/api/runs/latest/priorities", params={"h": 169}).json()["zones"]
    assert z and z[0]["level"] == "HIGH"


def test_events_respect_until(client):
    early = client.get("/api/runs/latest/events", params={"until": 60}).json()
    late = client.get("/api/runs/latest/events", params={"until": HOURS}).json()
    assert early["count"] < late["count"]


def test_missions_require_auth(client):
    assert client.get("/api/missions").status_code == 401


def test_mission_lifecycle_records_a_label(client, analyst_headers):
    body = {"zone_id": "Patch C", "name": "Patch C (at sea)", "kind": "sea", "level": "HIGH",
            "lon": 77.1, "lat": 8.3, "hour": 169, "team": "Kerala Fisheries Dept. boat",
            "planned_date": "2 Jun 2025", "notes": "sieves for pellets"}
    m = client.post("/api/missions", headers=analyst_headers, json=body)
    assert m.status_code == 201
    mid = m.json()["id"]
    assert client.patch(f"/api/missions/{mid}", headers=analyst_headers,
                        json={"status": "in_progress"}).json()["status"] == "in_progress"
    done = client.patch(f"/api/missions/{mid}", headers=analyst_headers,
                        json={"result": "nothing_found"}).json()
    assert done["status"] == "completed"
    labels = client.get("/api/field-results", headers=analyst_headers).json()
    assert labels["count"] >= 1
    assert any(r["mission_id"] == mid for r in labels["results"])


def test_field_user_sees_only_their_own_missions(client, analyst_headers):
    client.post("/api/missions", headers=analyst_headers,
                json={"zone_id": "Z1", "name": "Analyst only", "kind": "coast", "level": "LOW",
                      "lon": 77.5, "lat": 8.1, "hour": 100, "team": "NGO volunteer crew"})
    tok = client.post("/api/auth/login",
                      json={"email": "field@coastguard.demo", "password": "demo123"}).json()
    fh = {"Authorization": f"Bearer {tok['access_token']}"}
    mine = client.get("/api/missions", headers=fh).json()
    assert all(m["team"] == "Indian Coast Guard patrol" for m in mine)


def test_geojson_export(client):
    r = client.get("/api/export/geojson", params={"h": 169})
    assert r.headers["content-type"].startswith("application/geo+json")
    fc = json.loads(r.content)
    assert fc["type"] == "FeatureCollection" and fc["features"]


def test_sitrep_formats(client):
    j = client.get("/api/reports/sitrep", params={"h": 169}).json()
    assert j["incident"] == "MSC ELSA 3" and j["simulated"] is True
    md = client.get("/api/reports/sitrep", params={"h": 169, "format": "md"})
    assert md.text.startswith("# MSC ELSA 3")
    pdf = client.get("/api/reports/sitrep", params={"h": 169, "format": "pdf"})
    assert pdf.content[:4] == b"%PDF"


def test_model_report(client):
    m = client.get("/api/model").json()
    assert m["accuracy"] > 0.9
    assert len(m["confusion"]) == 4
    assert "debris" in m["spectra"]
    assert any(s["state"] == "simulated" for s in m["data_sources"])


def test_post_run_with_custom_parameters(client):
    r = client.post("/api/runs", json={"gate_km": 20, "confirm": 0.85, "reject": 0.2,
                                       "cloud_decay": 0.92, "nurdles": 600, "seed": 2025})
    assert r.status_code == 201
    assert r.json()["metrics"]["nurdles"] == 600
    assert r.json()["params"]["gate_km"] == 20


def test_bad_run_parameters_rejected(client):
    assert client.post("/api/runs", json={"gate_km": 500}).status_code == 422


def test_upload_rejects_empty_file(client):
    r = client.post("/api/detect/upload", files={"file": ("x.tif", b"", "image/tiff")})
    assert r.status_code == 400
