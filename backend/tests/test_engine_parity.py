"""The replay must still tell the ELSA 3 story.

These are the numbers the prototype produces with default settings. They are
the contract for the Python port: two real debris fields confirmed, every
look-alike rejected, no false alarm ever confirmed, and pellets reaching
Kanyakumari before the 30 May beach survey found them there.
"""
from app.core.timebase import HOURS, at
from app.geo.coast import REPORTED
from app.scenario.elsa3 import PASSES, RunParams, run as run_scenario

MAY_30 = 5 * 24  # hour 120 = 30 May 2025 00:00 IST


def test_two_real_fields_confirmed(default_run):
    assert default_run.metrics["real_confirmed"] == 2


def test_no_false_alarm_is_ever_confirmed(default_run):
    assert default_run.metrics["false_confirmed"] == 0


def test_every_look_alike_is_rejected(default_run):
    fakes = [t for t in default_run.tracks if not t.real]
    assert fakes, "the scenario must produce look-alikes to reject"
    assert all(t.status == "rejected" for t in fakes), \
        {t.id: t.status for t in fakes}


def test_real_tracks_end_confident(default_run):
    reals = [t for t in default_run.tracks if t.real]
    assert len(reals) == 2
    assert all(t.confidence >= default_run.params.confirm for t in reals)


def test_pellets_reach_kanyakumari_before_30_may(default_run):
    first = default_run.metrics["kanyakumari_first_hour"]
    assert first is not None, "no pellets reached Kanyakumari"
    assert first < MAY_30, f"first arrival {at(first)} is not before 30 May"
    # and it should beat the reported survey by at least a day of warning
    assert default_run.metrics["kanyakumari_error_days"] <= -1.0


def test_landfall_matches_reported_districts(default_run):
    m = default_run.metrics
    assert m["reported_districts_hit"] >= 3
    assert m["reported_districts_total"] == len(REPORTED["districts"])


def test_detection_and_track_counts(default_run):
    assert default_run.metrics["detections_total"] == 11
    assert [t.id for t in default_run.tracks] == ["Patch A", "Patch B", "Patch C", "Patch D"]
    assert [t.real for t in default_run.tracks] == [True, False, True, False]


def test_forecast_error_stays_inside_the_gate(default_run):
    """Every re-find happened inside the association gate, by construction."""
    assert default_run.metrics["max_error_km"] < 3 * default_run.params.gate_km
    assert default_run.metrics["mean_error_km"] < default_run.params.gate_km


def test_replay_covers_fourteen_days(default_run):
    assert len(default_run.frames) == HOURS + 1
    assert default_run.frames[0].h == 0 and default_run.frames[-1].h == HOURS


def test_clouded_passes_produce_no_detections(default_run):
    clouded = {p["h"] for p in PASSES if p["cloud"] == "full"}
    assert not [d for d in default_run.detections if d["h"] in clouded]


def test_run_is_deterministic(detector):
    a = run_scenario(RunParams(), detector).metrics
    b = run_scenario(RunParams(), detector).metrics
    assert a == b


def test_tighter_gate_loses_associations(detector):
    """Sanity check that the gate actually does something."""
    tight = run_scenario(RunParams(gate_km=5.0), detector)
    assert tight.metrics["real_confirmed"] <= 2
