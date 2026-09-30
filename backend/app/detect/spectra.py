"""Sentinel-2 style surface reflectance and the indices the detector runs on.

Six bands are enough to separate floating plastic from the three things that
fool a single-image detector: whitecap foam, a Sargassum-like algal raft and
sun glint. The reference spectra are the flat library the prototype uses --
they are stylised, not laboratory measurements, and the console labels them as
simulated.
"""
from __future__ import annotations

import numpy as np

BANDS = ["B2", "B3", "B4", "B6", "B8", "B11"]
WAVELENGTHS = [490, 560, 665, 740, 842, 1610]
CLASSES = ["debris", "foam", "algae", "water"]

SPECTRA: dict[str, list[float]] = {
    "water":  [0.060, 0.048, 0.026, 0.012, 0.009, 0.004],
    "debris": [0.078, 0.076, 0.068, 0.066, 0.082, 0.050],
    "foam":   [0.150, 0.148, 0.140, 0.118, 0.108, 0.040],
    "algae":  [0.046, 0.058, 0.036, 0.085, 0.118, 0.034],
    # glint is additive and spectrally flat, which is exactly why it is the
    # hardest look-alike in a single image
    "glint":  [0.048, 0.048, 0.048, 0.048, 0.048, 0.030],
}

_WATER = np.array(SPECTRA["water"])
_GLINT = np.array(SPECTRA["glint"])
NOISE_SD = 0.0045

# Floating Debris Index slope between the red and SWIR anchors (Biermann et al.)
_FDI_SLOPE = (832.8 - 664.6) / (1613.7 - 664.6) * 10.0

FEATURE_NAMES = BANDS + ["FDI", "NDVI", "NDWI"]


def mix(material: str, fraction, glint, noise: np.ndarray | float = 0.0) -> np.ndarray:
    """Linear sub-pixel mixture of a material with water, plus additive glint.

    ``fraction``/``glint`` may be arrays; the band axis is last.
    """
    m = np.asarray(SPECTRA.get(material, SPECTRA["water"]))
    f = np.asarray(fraction, dtype=np.float64)[..., None]
    g = np.asarray(glint, dtype=np.float64)[..., None]
    return f * m + (1.0 - f) * _WATER + g * _GLINT + noise


def features(px: np.ndarray) -> np.ndarray:
    """Six bands -> nine features. The band axis must be last."""
    px = np.asarray(px, dtype=np.float64)
    b2, b3, b4, b6, b8, b11 = (px[..., i] for i in range(6))
    fdi = b8 - (b6 + (b11 - b6) * _FDI_SLOPE)
    ndvi = (b8 - b4) / (b8 + b4 + 1e-6)
    ndwi = (b3 - b8) / (b3 + b8 + 1e-6)
    return np.stack([b2, b3, b4, b6, b8, b11, fdi, ndvi, ndwi], axis=-1)


def fdi(px: np.ndarray) -> np.ndarray:
    return features(px)[..., 6]


def training_set(n: int = 6000, seed: int = 7) -> tuple[np.ndarray, np.ndarray]:
    """Synthetic labelled pixels, balanced across the four classes.

    Water pixels carry only a trace of any material; the other three are mixed
    in at 22-100 % cover. A quarter of all pixels get a glint contamination on
    top, which is what forces the classifier to lean on band *shape* rather than
    brightness.
    """
    rng = np.random.default_rng(seed)
    y = np.arange(n) % 4
    is_water = y == 3
    frac = np.where(is_water, rng.random(n) * 0.18, 0.22 + 0.78 * rng.random(n))
    glint = np.where(rng.random(n) < 0.25, rng.random(n) * 0.6, 0.0)
    noise = rng.standard_normal((n, 6)) * NOISE_SD

    px = np.empty((n, 6))
    for c, name in enumerate(CLASSES):
        m = y == c
        px[m] = mix(name, frac[m], glint[m], noise[m])
    return features(px), y
