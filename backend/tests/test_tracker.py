"""The rules that decide whether a boat gets sent."""
import numpy as np
import pytest

from app.core.rng import Rng
from app.drift.particles import make_set
from app.track.tracker import TrackParams, Tracker


@pytest.fixture
def tracker():
    rng = Rng(1)
    return Tracker(TrackParams(), lambda n, lon, lat: make_set(n, lon, lat, 0.35, 0.004, 0.022, rng))


def _obs(i, lon, lat, q=0.9, real=True):
    return {"id": i, "lon": lon, "lat": lat, "q": q, "area_m2": 3000.0,
            "origin": "T1" if real else "glint", "real": real, "track": None}


CLEAR = lambda lon, lat: False
CLOUD = lambda lon, lat: True


def test_a_new_detection_starts_a_watching_track(tracker):
    tracker.process_pass(59, "27 May", [_obs(0, 76.5, 8.8)], CLEAR)
    tr = tracker.tracks[0]
    assert tr.id == "Patch A"
    assert tr.status == "watch"
    assert tr.confidence == pytest.approx(0.2 + 0.5 * 0.9)


def test_patches_are_lettered_in_order(tracker):
    tracker.process_pass(59, "27 May",
                         [_obs(0, 76.5, 8.8), _obs(1, 77.0, 8.4), _obs(2, 76.2, 9.1)], CLEAR)
    assert [t.id for t in tracker.tracks] == ["Patch A", "Patch B", "Patch C"]


def test_being_re_found_confirms_a_track(tracker):
    tracker.process_pass(59, "27 May", [_obs(0, 76.5, 8.8)], CLEAR)
    before = tracker.tracks[0].confidence
    tracker.process_pass(131, "30 May", [_obs(1, 76.51, 8.81, q=0.95)], CLEAR)
    tr = tracker.tracks[0]
    assert tr.confidence > before
    assert tr.status == "confirmed"
    assert len(tracker.tracks) == 1, "the second sighting must not start a new track"


def test_repeated_misses_reject_a_track(tracker):
    tracker.process_pass(59, "27 May", [_obs(0, 76.5, 8.8, q=0.6, real=False)], CLEAR)
    for h, label in ((131, "30 May"), (179, "1 Jun")):
        tracker.process_pass(h, label, [], CLEAR)
    tr = tracker.tracks[0]
    assert tr.status == "rejected"
    assert tr.confidence < TrackParams().reject


def test_cloud_barely_moves_confidence(tracker):
    tracker.process_pass(59, "27 May", [_obs(0, 76.5, 8.8)], CLEAR)
    before = tracker.tracks[0].confidence
    tracker.process_pass(83, "28 May", [], CLOUD)
    after = tracker.tracks[0].confidence
    assert after < before                      # not evidence for
    assert before - after < 0.05               # but nothing like a miss
    assert tracker.tracks[0].status == "watch"


def test_cloud_decay_is_gentler_than_a_miss(tracker):
    tracker.process_pass(59, "27 May", [_obs(0, 76.5, 8.8)], CLEAR)
    tracker.process_pass(83, "28 May", [], CLOUD)
    clouded = tracker.tracks[0].confidence

    other = Tracker(TrackParams(), lambda n, lo, la: make_set(n, lo, la, 0.35, 0.004, 0.022, Rng(2)))
    other.process_pass(59, "27 May", [_obs(0, 76.5, 8.8)], CLEAR)
    other.process_pass(83, "28 May", [], CLEAR)
    missed = other.tracks[0].confidence
    assert clouded > missed


def test_detection_outside_the_gate_starts_its_own_track(tracker):
    tracker.process_pass(59, "27 May", [_obs(0, 76.5, 8.8)], CLEAR)
    tracker.process_pass(131, "30 May", [_obs(1, 78.9, 9.2)], CLEAR)   # ~260 km away
    assert len(tracker.tracks) == 2
    assert tracker.tracks[0].history[-1]["event"] == "miss"


def test_one_detection_can_only_feed_one_track(tracker):
    tracker.process_pass(59, "27 May", [_obs(0, 76.50, 8.80), _obs(1, 76.56, 8.80)], CLEAR)
    tracker.process_pass(131, "30 May", [_obs(2, 76.53, 8.80)], CLEAR)
    matched = [t for t in tracker.tracks if t.history[-1]["event"] == "match"]
    assert len(matched) == 1, "nearest-first association must not double-book"


def test_confidence_stays_inside_bounds(tracker):
    tracker.process_pass(59, "27 May", [_obs(0, 76.5, 8.8, q=0.99)], CLEAR)
    for i, h in enumerate(range(80, 340, 24)):
        tracker.process_pass(h, f"pass {i}", [_obs(100 + i, 76.5, 8.8, q=0.99)], CLEAR)
    assert tracker.tracks[0].confidence <= 0.99


def test_rejected_tracks_stop_being_updated(tracker):
    tracker.process_pass(59, "27 May", [_obs(0, 76.5, 8.8, q=0.6, real=False)], CLEAR)
    for h in (131, 179):
        tracker.process_pass(h, "x", [], CLEAR)
    n = len(tracker.tracks[0].history)
    tracker.process_pass(251, "4 Jun", [], CLEAR)
    assert len(tracker.tracks[0].history) == n


def test_gate_widens_with_forecast_spread(tracker):
    """A cloud that has spread out gets a wider search radius than the floor."""
    tracker.process_pass(59, "27 May", [_obs(0, 76.5, 8.8)], CLEAR)
    tr = tracker.tracks[0]
    tr.particles.x += np.linspace(-0.25, 0.25, len(tr.particles)).astype(np.float32)
    spread = tr.particles.stats()["sd_km"]
    assert 3 * spread > TrackParams().gate_km
    tracker.process_pass(131, "30 May", [_obs(1, 76.5 + 0.2, 8.8)], CLEAR)
    assert tr.history[-1]["event"] == "match", "a wide forecast must gate wider"
