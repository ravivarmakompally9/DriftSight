"""Replay clock.

Hour 0 is 25 May 2025 00:00 IST -- the morning MSC ELSA 3 went down. The replay
runs 14 days (336 hours). Everything the console shows is labelled IST because
that is what the agencies on this coast work in.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
T0 = datetime(2025, 5, 25, 0, 0, tzinfo=IST)
HOURS = 14 * 24
DAYS = 14


def at(hour: float) -> datetime:
    return T0 + timedelta(hours=float(hour))


def iso(hour: float) -> str:
    return at(hour).isoformat()


def day_label(hour: float) -> str:
    d = at(hour)
    return f"{d.day} {d.strftime('%b')}"


def time_label(hour: float) -> str:
    return at(hour).strftime("%H:%M")


def label(hour: float) -> str:
    return f"{day_label(hour)}, {time_label(hour)}"


def label_ist(hour: float) -> str:
    return f"{label(hour)} IST"
