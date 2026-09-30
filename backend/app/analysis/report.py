"""The situation report: the thing an analyst actually forwards.

Rendered for any replay hour, as Markdown for the console and as a PDF for
email. Both carry the same prototype caveat: the imagery and the ocean fields
are simulated.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone

from app.analysis.forecast import pellet_state
from app.analysis.priority import priorities
from app.core.timebase import day_label, label_ist
from app.geo.coast import DISTRICTS, nearest_harbour
from app.scenario.elsa3 import PASSES, SHIP

CAVEAT = (
    "Prototype. Detection imagery and ocean fields in this report are simulated; "
    "no figure here is a measurement. Production sources: Sentinel-2 / Landsat / "
    "Sentinel-1 imagery, INCOIS and CMEMS currents, ERA5 winds."
)


def sitrep(run, h: int, missions: list[dict] | None = None) -> dict:
    missions = missions or []
    fr = run.frame(h)
    zones = priorities(run, h)
    pellets = pellet_state(run, h)
    counts = {s: sum(1 for x in fr.track_status if x == s)
              for s in ("confirmed", "watch", "rejected", "landed")}
    passes = [p for p in PASSES if p["h"] <= h]
    clear = sum(1 for p in passes if p["cloud"] != "full")
    dets = [d for d in run.detections if d["h"] <= h]
    live = [t for t in run.tracks if t.born <= h]

    top_land = sorted(
        [d for d in DISTRICTS if run.landfall[d]["n"]],
        key=lambda d: -run.landfall[d]["share"],
    )[:4]

    n_conf, n_rej = counts["confirmed"], counts["rejected"]
    confirmed_clause = (
        "none is confirmed yet (confirmation needs a second clear look)" if n_conf == 0 else
        "1 is confirmed because it re-appeared where the currents predicted" if n_conf == 1 else
        f"{n_conf} are confirmed because they re-appeared where the currents predicted"
    )
    rejected_clause = (
        "1 look-alike was rejected before any boat was sent" if n_rej == 1 else
        "no look-alikes have been rejected yet" if n_rej == 0 else
        f"{n_rej} look-alikes were rejected before any boat was sent"
    )
    summary = (
        f"{len(passes)} satellite {'pass' if len(passes) == 1 else 'passes'} processed since "
        f"the sinking on 25 May 2025 ({clear} usable, {len(passes) - clear} clouded). "
        f"DriftSight has flagged {len(dets)} candidate debris "
        f"{'patch' if len(dets) == 1 else 'patches'}; {confirmed_clause}, and "
        f"{rejected_clause}. The pellet forecast puts "
        f"{pellets['ashore_pct']:.0f}% of the simulated nurdles ashore by this time."
    )

    return {
        "incident": SHIP["name"],
        "as_of_hour": int(h),
        "as_of": label_ist(h),
        "generated": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "facts": [
            {"value": counts["confirmed"], "label": "confirmed debris patches"},
            {"value": counts["rejected"], "label": "look-alikes rejected"},
            {"value": f"{pellets['ashore_pct']:.0f}%", "label": "pellets ashore (forecast)"},
            {"value": sum(1 for z in zones if z["level"] == "HIGH"), "label": "high-priority zones"},
        ],
        "counts": counts,
        "pellets": pellets,
        "passes": {"total": len(PASSES), "done": len(passes), "usable": clear},
        "tracks": [
            {
                "id": t.id,
                "first_seen": label_ist(t.born),
                "area_m2": round(t.area_m2),
                "confidence": round(fr.track_conf[fr.track_ids.index(t.id)], 3)
                if t.id in fr.track_ids else round(t.confidence, 3),
                "status": fr.track_status[fr.track_ids.index(t.id)]
                if t.id in fr.track_ids else t.status,
            }
            for t in live
        ],
        "landfall_line": (
            " · ".join(
                f"{d} {run.landfall[d]['share'] * 100:.0f}% (first {day_label(run.landfall[d]['first'])})"
                for d in top_land
            )
            + (
                f". Forecast first arrival at Kanyakumari "
                f"{label_ist(run.metrics['kanyakumari_first_hour'])}, consistent with the "
                f"30 May beach survey that rated pellet pollution “Very High”."
                if run.metrics["kanyakumari_first_hour"] is not None else "."
            )
        ),
        "priorities": [
            {
                "level": z["level"], "name": z["name"],
                "lat": z["lat"], "lon": z["lon"],
                "action": z["action"],
                "harbour": nearest_harbour(z["lon"], z["lat"])["harbour"]["n"],
            }
            for z in zones[:4]
        ],
        "missions": {
            "total": len(missions),
            "planned": sum(1 for m in missions if m["status"] == "planned"),
            "in_progress": sum(1 for m in missions if m["status"] == "in_progress"),
            "completed": sum(1 for m in missions if m["status"] == "completed"),
        },
        "method": (
            "Detection: per-pixel classifier on Sentinel-2 bands with FDI/NDVI. "
            "Tracking: ensemble particle drift with Bayesian confirmation at each pass. "
            "Prototype uses synthetic imagery and a synthetic monsoon circulation; "
            "production uses Sentinel-2/Landsat/Sentinel-1, INCOIS/CMEMS currents and ERA5 winds."
        ),
        "caveat": CAVEAT,
        "simulated": True,
    }


def to_markdown(rep: dict) -> str:
    L: list[str] = []
    L.append(f"# {rep['incident']} — floating debris & pellet drift")
    L.append("")
    L.append(f"**Situation report · marine debris** — as of {rep['as_of']}")
    L.append("Prepared by DriftSight · prototype")
    L.append("")
    L.append(f"**Summary.** {rep['summary']}")
    L.append("")
    L.append("| | |")
    L.append("|---|---|")
    for f in rep["facts"]:
        L.append(f"| **{f['value']}** | {f['label']} |")
    L.append("")
    L.append("## Tracked patches")
    if rep["tracks"]:
        L.append("| Patch | First seen | Area | Confidence | Status |")
        L.append("|---|---|---:|---:|---|")
        for t in rep["tracks"]:
            L.append(f"| {t['id']} | {t['first_seen']} | {t['area_m2']:,} m² | "
                     f"{round(t['confidence'] * 100)}% | {t['status']} |")
    else:
        L.append("No patches detected yet.")
    L.append("")
    L.append("## Pellet landfall outlook")
    L.append(rep["landfall_line"])
    L.append("")
    L.append("## Priority actions")
    if rep["priorities"]:
        for i, z in enumerate(rep["priorities"], 1):
            L.append(f"{i}. **{z['level']}** — {z['name']} "
                     f"({z['lat']:.3f}°N {z['lon']:.3f}°E): {z['action']} "
                     f"Nearest harbour {z['harbour']}.")
    else:
        L.append("No zones need action at this time.")
    L.append("")
    m = rep["missions"]
    L.append("## Missions")
    L.append(f"{m['planned']} planned, {m['in_progress']} in progress, {m['completed']} completed."
             if m["total"] else "No missions created yet.")
    L.append("")
    L.append("## Data & method")
    L.append(rep["method"])
    L.append("")
    L.append(f"> {rep['caveat']}")
    return "\n".join(L)


def to_pdf(rep: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    navy = colors.HexColor("#0B1B33")
    teal = colors.HexColor("#0B7A83")
    grey = colors.HexColor("#56637A")

    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], fontName="Helvetica-Bold",
                        fontSize=19, leading=23, textColor=navy, alignment=TA_LEFT)
    kicker = ParagraphStyle("kicker", parent=ss["Normal"], fontSize=8, leading=11,
                            textColor=grey, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold",
                        fontSize=10, leading=13, textColor=grey, spaceBefore=12, spaceAfter=5)
    body = ParagraphStyle("body", parent=ss["Normal"], fontSize=9.5, leading=14, textColor=navy)
    note = ParagraphStyle("note", parent=body, fontSize=8, leading=11, textColor=grey)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=f"DriftSight sitrep — {rep['incident']}",
                            author="DriftSight (prototype)",
                            leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm)
    F: list = []
    F.append(Paragraph("SITUATION REPORT · MARINE DEBRIS", kicker))
    F.append(Paragraph(f"{rep['incident']} — floating debris &amp; pellet drift", h1))
    F.append(Paragraph(f"As of {rep['as_of']} · Prepared by DriftSight · prototype", kicker))
    F.append(Spacer(1, 4))
    F.append(HRFlowable(width="100%", thickness=1.2, color=navy, spaceAfter=10))

    F.append(Paragraph(f"<b>Summary.</b> {rep['summary']}", body))
    F.append(Spacer(1, 8))

    facts = Table([[str(f["value"]) for f in rep["facts"]],
                   [f["label"] for f in rep["facts"]]],
                  colWidths=[doc.width / 4.0] * 4)
    facts.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 16),
        ("FONT", (0, 1), (-1, 1), "Helvetica", 7.5),
        ("TEXTCOLOR", (0, 0), (-1, 0), teal),
        ("TEXTCOLOR", (0, 1), (-1, 1), grey),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E6EF")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E6EF")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    F.append(facts)

    F.append(Paragraph("TRACKED PATCHES", h2))
    if rep["tracks"]:
        rows = [["Patch", "First seen", "Area", "Confidence", "Status"]]
        rows += [[t["id"], t["first_seen"], f"{t['area_m2']:,} m²",
                  f"{round(t['confidence'] * 100)}%", t["status"]] for t in rep["tracks"]]
        tbl = Table(rows, colWidths=[doc.width * w for w in (0.16, 0.28, 0.18, 0.18, 0.20)])
        tbl.setStyle(TableStyle([
            ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 7.5),
            ("FONT", (0, 1), (-1, -1), "Helvetica", 8.5),
            ("TEXTCOLOR", (0, 0), (-1, 0), grey),
            ("TEXTCOLOR", (0, 1), (-1, -1), navy),
            ("ALIGN", (2, 0), (3, -1), "RIGHT"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#E0E6EF")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        F.append(tbl)
    else:
        F.append(Paragraph("No patches detected yet.", body))

    F.append(Paragraph("PELLET LANDFALL OUTLOOK", h2))
    F.append(Paragraph(rep["landfall_line"], body))

    F.append(Paragraph("PRIORITY ACTIONS", h2))
    if rep["priorities"]:
        for i, z in enumerate(rep["priorities"], 1):
            F.append(Paragraph(
                f"{i}. <b>{z['level']}</b> — {z['name']} "
                f"({z['lat']:.3f}°N {z['lon']:.3f}°E): {z['action']} "
                f"Nearest harbour {z['harbour']}.", body))
    else:
        F.append(Paragraph("No zones need action at this time.", body))

    m = rep["missions"]
    F.append(Paragraph("MISSIONS", h2))
    F.append(Paragraph(
        f"{m['planned']} planned, {m['in_progress']} in progress, {m['completed']} completed."
        if m["total"] else "No missions created yet.", body))

    F.append(Paragraph("DATA &amp; METHOD", h2))
    F.append(Paragraph(rep["method"], note))
    F.append(Spacer(1, 6))
    F.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E0E6EF"), spaceAfter=6))
    F.append(Paragraph(rep["caveat"], note))

    doc.build(F)
    return buf.getvalue()
