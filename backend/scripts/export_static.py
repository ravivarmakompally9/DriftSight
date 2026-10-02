"""Snapshot the API into JSON files for the static (GitHub Pages) build.

The replay is deterministic for a given run, so every GET the frontend makes
can be answered ahead of time. The static build (`VITE_STATIC=1`) reads these
files instead of calling the backend.

    cd backend && .venv/bin/python scripts/export_static.py ../frontend/dist/data
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.api.deps import HOURS  # noqa: E402
from app.main import app  # noqa: E402

# Mass is linear in the assumed release, so one export at the maximum lets the
# client rescale to whatever the operator types.
MASS_REF_TONNES = 100000
CURRENTS_BBOX = "75.4,7.2,80.0,10.2"


def slug(track_id: str) -> str:
    return track_id.replace(" ", "_")


def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)

    def write(rel: str, data) -> None:
        p = out / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, separators=(",", ":")))

    with TestClient(app) as c:
        def get(path: str, **params):
            r = c.get(f"/api{path}", params=params)
            r.raise_for_status()
            return r.json()

        accounts = get("/auth/demo-accounts")
        users = {}
        for a in accounts:
            r = c.post("/api/auth/login", json={"email": a["email"], "password": a["password"]})
            r.raise_for_status()
            users[a["email"]] = r.json()["user"]
        analyst = next(a for a in accounts if a["role"] == "analyst")
        token = c.post("/api/auth/login", json={"email": analyst["email"],
                                               "password": analyst["password"]}).json()["access_token"]
        auth = {"Authorization": f"Bearer {token}"}

        run = get("/runs/latest")
        rid = run["id"]
        tracks_all = get(f"/runs/{rid}/tracks")["tracks"]
        dets_all = get(f"/runs/{rid}/detections")

        write("meta.json", {
            "run": run, "accounts": accounts, "users": users,
            "incident": get("/incidents/elsa3"), "passes": get("/passes"),
            "model": get("/model"), "timeline": get(f"/runs/{rid}/timeline"),
            "missions": c.get("/api/missions", headers=auth).json(),
            "mass_ref_tonnes": MASS_REF_TONNES, "hours": HOURS,
        })
        write("geo.json", get("/geo"))
        write("all.json", {
            "detections": dets_all,
            "tracks": tracks_all,
            "forecast": get(f"/runs/{rid}/forecast", tonnes=MASS_REF_TONNES),
        })
        for d in dets_all["detections"]:
            write(f"detection/{d['id']}.json", get(f"/detections/{d['id']}", run_id=rid))
        for t in tracks_all:
            r = c.post(f"/api/tracks/{t['id']}/backtrace", params={"run_id": rid})
            if r.status_code == 200:
                write(f"backtrace/{slug(t['id'])}.json", r.json())

        for h in range(HOURS + 1):
            write(f"hour/{h}.json", {
                "summary": get(f"/runs/{rid}/summary", h=h, tonnes=MASS_REF_TONNES),
                "detections": get(f"/runs/{rid}/detections", h=h),
                "tracks": get(f"/runs/{rid}/tracks", h=h),
                "forecast": get(f"/runs/{rid}/forecast", h=h, tonnes=MASS_REF_TONNES),
                "priorities": get(f"/runs/{rid}/priorities", h=h),
                "events": get(f"/runs/{rid}/events", until=h),
                "sitrep": get("/reports/sitrep", run_id=rid, h=h),
            })
            write(f"frame/{h}.json", get(f"/runs/{rid}/frame/{h}"))
            write(f"truth/{h}.json", get(f"/runs/{rid}/frame/{h}", truth=1))
            write(f"currents/{h}.json", get("/currents", h=h, bbox=CURRENTS_BBOX, nx=22, ny=22))
            sitrep_pdf = c.get("/api/reports/sitrep", params={"run_id": rid, "h": h, "format": "pdf"})
            sitrep_pdf.raise_for_status()
            (out / "pdf").mkdir(exist_ok=True)
            (out / "pdf" / f"sitrep-{h}.pdf").write_bytes(sitrep_pdf.content)
            gj = c.get("/api/export/geojson", params={"run_id": rid, "h": h}, headers=auth)
            gj.raise_for_status()
            (out / "geojson").mkdir(exist_ok=True)
            (out / "geojson" / f"zones-{h}.geojson").write_bytes(gj.content)
            if h % 48 == 0:
                print(f"  hour {h}/{HOURS}", flush=True)

    size = sum(p.stat().st_size for p in out.rglob("*") if p.is_file())
    print(f"Wrote {out} ({size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "../frontend/dist/data"))
