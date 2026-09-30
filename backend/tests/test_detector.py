import numpy as np

from app.core.rng import Rng
from app.detect.chips import detect_chip, make_chip
from app.detect.model import train
from app.detect.spectra import CLASSES, SPECTRA, features, training_set


def test_held_out_accuracy_above_90_percent(detector):
    assert detector.accuracy > 0.9


def test_confusion_matrix_is_diagonally_dominant(detector):
    cm = np.array(detector.confusion)
    assert cm.shape == (4, 4)
    assert cm.sum() == detector.n_test
    for i in range(4):
        assert cm[i, i] > cm[i].sum() * 0.8, f"{CLASSES[i]} row: {cm[i]}"


def test_detector_is_reproducible():
    assert train(seed=7).accuracy == train(seed=7).accuracy


def test_pure_debris_pixel_classifies_as_debris(detector):
    px = np.array(SPECTRA["debris"])[None, :]
    assert int(np.argmax(detector.proba(px)[0])) == CLASSES.index("debris")


def test_debris_chip_is_detected(detector):
    chip = make_chip("debris", 3800, Rng(2027), 0.0)
    d = detect_chip(chip, detector)
    assert d is not None
    assert d["q"] > 0.8
    assert d["px"] >= 20


def test_detected_blob_lands_on_the_real_footprint(detector):
    chip = make_chip("debris", 3800, Rng(2027), 0.0)
    detect_chip(chip, detector)
    hit = ((chip.prob >= 0.5) & (chip.truth == 1)).sum()
    assert hit / max(1, (chip.prob >= 0.5).sum()) > 0.8


def test_sun_glint_still_fools_a_single_image(detector):
    """A detector that never confuses glint would make the tracker pointless --
    and would not match any published single-image result."""
    chip = make_chip("glint", 2500, Rng(2027), 1.0)
    d = detect_chip(chip, detector)
    assert d is not None
    assert d["q"] < 0.9, "glint should look uncertain, not like confident plastic"


def test_open_water_chip_gives_nothing(detector):
    chip = make_chip("water", 2500, Rng(11), 0.0)
    assert detect_chip(chip, detector) is None


def test_fdi_separates_debris_from_water():
    f_debris = features(np.array(SPECTRA["debris"]))[6]
    f_water = features(np.array(SPECTRA["water"]))[6]
    assert f_debris > f_water


def test_training_set_is_balanced():
    X, y = training_set(800, seed=3)
    assert X.shape == (800, 9)
    assert np.bincount(y).tolist() == [200, 200, 200, 200]
