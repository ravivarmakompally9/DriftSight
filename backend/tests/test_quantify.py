"""The physical-units layer: the answers a person arrives wanting."""
import pytest

from app.analysis.quantify import (
    area_phrase, bearing, coast_affected, describe_position, headline,
    mass_estimate, nearest_place, pitches, plastic_afloat,
)
from app.core.timebase import HOURS


def test_position_is_described_against_a_named_place(default_run):
    assert describe_position(76.5, 8.8) == "14 km SW of Kollam"
    assert "Kanyakumari" in describe_position(77.54, 8.08)


def test_bearing_points_the_right_way():
    assert bearing(76.0, 9.0, 76.0, 10.0) == "N"
    assert bearing(76.0, 9.0, 76.0, 8.0) == "S"
    assert bearing(76.0, 9.0, 77.0, 9.0) == "E"
    assert bearing(76.0, 9.0, 75.0, 9.0) == "W"


def test_nearest_place_picks_the_closest():
    assert nearest_place(77.54, 8.08)["name"] == "Kanyakumari"
    assert nearest_place(76.27, 9.97)["name"] == "Kochi"


def test_area_is_given_something_to_picture_it_against():
    assert "football pitch" in area_phrase(7140)
    assert "football pitches" in area_phrase(30000)
    assert area_phrase(0) == "none"
    assert pitches(7140) == 1.0


def test_afloat_reports_area_not_just_a_count(default_run):
    a = plastic_afloat(default_run, 180)
    assert a["confirmed_fields"] == 2
    assert a["confirmed_area_m2"] > 0, "a count of fields is not a quantity of plastic"
    assert a["largest"]["where"]
    assert a["largest"]["nearest_harbour"]


def test_coast_affected_is_a_real_length(default_run):
    c = coast_affected(default_run, HOURS)
    assert c["km"] > 0
    assert c["district_count"] >= 3
    assert c["places"], "affected coast should name places, not just districts"
    # the per-district lengths cannot exceed the whole
    assert sum(c["km_by_district"].values()) == pytest.approx(c["km"], rel=0.01)


def test_coast_grows_over_the_replay(default_run):
    early = coast_affected(default_run, 60)["km"]
    late = coast_affected(default_run, HOURS)["km"]
    assert late > early


def test_headline_answers_is_there_plastic(default_run):
    h = headline(default_run, 180)
    assert h["found"] is True
    assert h["verdict"] == "Plastic confirmed"
    assert "m²" in h["sentence"] and "km of coast" in h["sentence"]


def test_headline_does_not_overclaim_before_a_pass(default_run):
    h = headline(default_run, 10)
    assert h["found"] is False
    assert h["verdict"] != "Plastic confirmed"


def test_headline_distinguishes_watching_from_confirmed(default_run):
    """At the first pass three candidates exist but none is confirmed yet."""
    h = headline(default_run, 60)
    assert h["found"] is False
    assert h["afloat"]["watching_fields"] > 0


def test_mass_is_absent_until_an_assumption_is_supplied(default_run):
    assert mass_estimate(default_run, 180, 0) is None
    assert mass_estimate(default_run, 180, None) is None


def test_mass_scales_linearly_with_the_assumption_and_says_so(default_run):
    a = mass_estimate(default_run, 180, 50)
    b = mass_estimate(default_run, 180, 100)
    assert a["is_assumption"] is True
    assert "assum" in a["note"].lower()
    # equal up to the one-decimal rounding the figures are displayed at
    assert b["ashore_tonnes"] == pytest.approx(a["ashore_tonnes"] * 2, abs=0.2)


def test_mass_ashore_and_afloat_cannot_exceed_the_release(default_run):
    m = mass_estimate(default_run, 180, 50)
    assert m["ashore_tonnes"] + m["afloat_tonnes"] <= 50 + 1e-6
