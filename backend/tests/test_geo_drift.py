import numpy as np

from app.core.rng import Rng
from app.drift.particles import AFLOAT, BEACHED, LOST, make_set, step
from app.geo.coast import WRECK, district, geo, nearest_harbour, sensitivity
from app.ocean.providers import FORECAST_PROVIDER, TRUTH_PROVIDER


def test_land_mask_covers_the_incident_area():
    g = geo()
    assert g.mask.shape == (g.ny, g.nx)
    assert g.is_land(77.0, 8.6) is True or bool(g.is_land(77.0, 8.6))   # inland Tamil Nadu
    assert not g.is_land(*[WRECK["lon"], WRECK["lat"]])                  # wreck is at sea


def test_is_land_is_vectorised():
    g = geo()
    out = g.is_land(np.array([76.1, 77.0]), np.array([9.3, 8.6]))
    assert out.tolist() == [False, True]


def test_coast_distance_is_zero_on_land_and_positive_at_sea():
    g = geo()
    assert g.coast_distance_km(77.0, 8.6) == 0.0
    assert g.coast_distance_km(WRECK["lon"], WRECK["lat"]) > 10


def test_district_lookup_follows_the_coast():
    assert district(76.30, 9.90) == "Ernakulam"
    assert district(77.50, 8.08) == "Kanyakumari"
    assert district(79.30, 9.29) == "Ramanathapuram"


def test_protected_water_raises_sensitivity():
    assert sensitivity(78.7, 9.0) > sensitivity(76.3, 9.9)


def test_nearest_harbour():
    assert nearest_harbour(77.56, 8.09)["harbour"]["n"] == "Chinnamuttom"


def test_current_is_equatorward_along_the_kerala_coast():
    u, v = FORECAST_PROVIDER.current(76.15, 9.3, 0.0)
    assert v < 0, "SW monsoon coastal current should run south here"
    assert np.hypot(u, v) < 1.0


def test_current_accepts_arrays():
    u, v = FORECAST_PROVIDER.current(np.array([76.2, 77.0]), np.array([9.0, 8.3]), 5.0)
    assert u.shape == (2,) and v.shape == (2,)


def test_truth_and_forecast_fields_differ():
    a = TRUTH_PROVIDER.current(76.4, 8.9, 40.0)
    b = FORECAST_PROVIDER.current(76.4, 8.9, 40.0)
    assert a != b, "the tracker must face a forecast error, not a perfect model"


def test_particles_drift_and_stay_in_the_domain():
    rng = Rng(5)
    P = make_set(200, WRECK["lon"], WRECK["lat"], 0.5, 0.01, 0.02, rng)
    start = P.stats()
    for h in range(72):
        step(P, h, FORECAST_PROVIDER, rng, 1, 12.0)
    end = P.stats()
    assert end["lat"] < start["lat"], "the cloud should have moved south"
    assert end["sd_km"] > start["sd_km"], "diffusion should spread it"
    assert set(np.unique(P.state)) <= {AFLOAT, BEACHED, LOST}


def test_particles_beach_and_stop_moving():
    rng = Rng(6)
    P = make_set(400, 76.5, 8.9, 3.0, 0.02, 0.03, rng)
    for h in range(200):
        step(P, h, FORECAST_PROVIDER, rng, 1, 20.0)
    beached = P.state == BEACHED
    assert beached.any(), "some particles must reach the coast"
    assert (P.beach_hour[beached] >= 0).all()
    before = P.x[beached].copy()
    step(P, 200, FORECAST_PROVIDER, rng, 1, 20.0)
    assert np.array_equal(P.x[beached], before)


def test_backward_drift_runs_upstream():
    rng = Rng(7)
    P = make_set(80, 76.6, 8.6, 0.4, 0.01, 0.02, rng)
    start = P.stats()
    for h in range(48, 0, -1):
        step(P, h, FORECAST_PROVIDER, rng, -1, 8.0)
    assert P.stats()["lat"] > start["lat"], "running time backwards should go north"


def test_particles_never_start_on_land():
    g = geo()
    P = make_set(300, 76.99, 8.38, 4.0, 0.01, 0.02, Rng(8))   # right on Vizhinjam
    assert not g.is_land(P.x.astype(float), P.y.astype(float)).any()
