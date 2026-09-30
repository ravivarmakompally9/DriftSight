"""Where the pellets come ashore, and whether that matches what was reported.

Nurdles are a few millimetres across -- nothing in orbit can see them. The only
way to warn a beach is to forecast them, which is what the pellet cloud does.
"""
from __future__ import annotations

from app.core.timebase import HOURS, day_label, label_ist
from app.drift.particles import AFLOAT, BEACHED
from app.geo.coast import DISTRICTS, REPORTED

CURVE_STEP_H = 6


def landfall_report(run) -> dict:
    nn = run.metrics["nurdles"]
    steps = list(range(0, HOURS + 1, CURVE_STEP_H))
    districts = []
    for d in DISTRICTS:
        L = run.landfall[d]
        if not L["n"] and d not in REPORTED["districts"]:
            continue
        hours = L["hours"]
        cumulative = []
        i = 0
        acc = 0
        for t in steps:
            while i < len(hours) and hours[i] <= t:
                i += 1
                acc += 1
            cumulative.append(round(acc / nn * 100.0, 3) if nn else 0.0)
        districts.append({
            "district": d,
            "pellets": L["n"],
            "share": round(L["share"], 5),
            "share_pct": round(L["share"] * 100, 2),
            "first_hour": L["first"],
            "first_at": label_ist(L["first"]) if L["first"] is not None else None,
            "p10_hour": L["p10"],
            "median_hour": L["p50"],
            "median_at": day_label(L["p50"]) if L["p50"] is not None else None,
            "reported_ashore": d in REPORTED["districts"],
            "cumulative_pct": cumulative,
        })
    districts.sort(key=lambda r: -r["share"])

    m = run.metrics
    err = m["kanyakumari_error_days"]
    validation = {
        "forecast_first_arrival_kanyakumari": (
            label_ist(m["kanyakumari_first_hour"]) if m["kanyakumari_first_hour"] is not None else None),
        "reported_survey": "30 May 2025",
        "reported_finding": "Pellet index “Very High”",
        "lead_time_days": None if err is None else round(-err, 2),
        "ahead_of_report": None if err is None else err <= 0,
        "reported_districts_hit": m["reported_districts_hit"],
        "reported_districts_total": m["reported_districts_total"],
        "reported_districts": REPORTED["districts"],
        "missed_districts": [d for d in REPORTED["districts"]
                             if run.landfall[d]["share"] < 0.005],
        "source": REPORTED["note"],
        "caveat": (
            "Forecast from a simulated monsoon circulation, not a measured ocean "
            "field. The missed districts are the honest limit of that simulation; "
            "real INCOIS/CMEMS currents replace it in production."
        ),
    }
    return {
        "hours": steps,
        "nurdles": nn,
        "districts": districts,
        "validation": validation,
        "simulated": True,
    }


def pellet_state(run, h: int) -> dict:
    fr = run.frame(h)
    nn = len(fr.nurdle_state)
    ashore = int((fr.nurdle_state == BEACHED).sum())
    afloat = int((fr.nurdle_state == AFLOAT).sum())
    return {
        "total": nn,
        "ashore": ashore,
        "afloat": afloat,
        "ashore_pct": round(ashore / nn * 100, 1) if nn else 0.0,
        "afloat_pct": round(afloat / nn * 100, 1) if nn else 0.0,
    }
