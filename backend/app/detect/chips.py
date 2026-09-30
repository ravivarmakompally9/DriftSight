"""Synthetic image chips and the detector that runs over them.

A chip is a 24x24 window of 10 m pixels -- 240 m on a side -- with the six
bands the classifier needs. In the prototype the chips are *generated*: there
is no Sentinel-2 download anywhere in this repo, and every screen that shows a
chip says so. `detect_geotiff` is the same detector pointed at a real 6-band
raster, so an analyst can drop in an actual scene today.
"""
from __future__ import annotations

import io
import math
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from scipy import ndimage

from app.core.rng import Rng
from app.detect.model import Detector, get_detector
from app.detect.spectra import BANDS, NOISE_SD, SPECTRA, features

CHIP = 24
PIXEL_M = 10.0
PIXEL_AREA_M2 = PIXEL_M * PIXEL_M
DETECT_THRESHOLD = 0.5
MIN_COMPONENT_PX = 3

_WATER = np.array(SPECTRA["water"])
_GLINT = np.array(SPECTRA["glint"])


@dataclass
class Chip:
    bands: np.ndarray                 # (6, 576) float32, band-major like the prototype
    truth: np.ndarray                 # (576,) uint8 -- the hidden footprint, demo only
    material: str
    size: int = CHIP
    prob: Optional[np.ndarray] = None  # (576,) P(debris)
    cls: Optional[np.ndarray] = None   # (576,) argmax class
    source: str = "synthetic"
    meta: dict = field(default_factory=dict)

    def band_lists(self) -> list[list[float]]:
        return [[round(float(v), 5) for v in b] for b in self.bands]


def make_chip(material: str, area_m2: float, rng: Rng, glint_level: float = 0.0) -> Chip:
    """Build one chip containing an elongated patch of ``material``.

    Draw order matches the reference generator exactly, so a chip produced here
    is the same image the JavaScript prototype produces for the same seed.
    """
    n = CHIP * CHIP
    npx = max(4, min(220, math.floor(area_m2 / 100.0 + 0.5)))

    ang = rng.next() * np.pi
    elong = 2.0 + rng.next() * 3.0
    b_ax = np.sqrt(npx / (np.pi * elong))
    a_ax = b_ax * elong
    cx = CHIP / 2.0 + rng.gauss1()
    cy = CHIP / 2.0 + rng.gauss1()

    jj, ii = np.divmod(np.arange(n), CHIP)          # raster order: row-major
    dx = ii - cx
    dy = jj - cy
    u = dx * np.cos(ang) + dy * np.sin(ang)
    v = -dx * np.sin(ang) + dy * np.cos(ang)
    q = (u / a_ax) ** 2 + (v / b_ax) ** 2

    # Every pixel consumes a fixed 13 uniforms (1 for glint + 12 for the
    # six-band noise), plus one more when it sits inside the soft edge.
    has_f = q < 1.6
    counts = 13 + has_f.astype(np.int64)
    offsets = np.concatenate([[0], np.cumsum(counts)[:-1]])
    raw = rng.raw(int(counts.sum()))

    f = np.zeros(n)
    inner = q < 1.0
    fr = raw[offsets[has_f]]
    f[has_f] = np.where(inner[has_f], 0.45 + 0.5 * fr, 0.15 * fr)

    gr = raw[offsets + has_f.astype(np.int64)]
    if material == "glint":
        g = np.where(q < 1.3, glint_level * (0.6 + 0.4 * gr), 0.05 * gr * glint_level)
        spec = _WATER
        frac = np.zeros(n)
    else:
        g = 0.1 * gr * glint_level
        spec = np.asarray(SPECTRA.get(material, SPECTRA["water"]))
        frac = f

    base = offsets + has_f.astype(np.int64) + 1
    pairs = raw[(base[:, None] + np.arange(12)[None, :])].reshape(n, 6, 2)
    rad = np.where(pairs[:, :, 0] == 0.0, np.nextafter(0.0, 1.0), pairs[:, :, 0])
    noise = np.sqrt(-2.0 * np.log(rad)) * np.cos(2.0 * np.pi * pairs[:, :, 1]) * NOISE_SD

    px = frac[:, None] * spec + (1.0 - frac)[:, None] * _WATER + g[:, None] * _GLINT + noise
    return Chip(bands=px.astype(np.float32).T.copy(),
                truth=inner.astype(np.uint8),
                material=material)


def _largest_component(prob: np.ndarray, shape=(CHIP, CHIP)) -> np.ndarray:
    """Indices of the biggest 4-connected blob above the detection threshold.

    Ties go to the blob found first in raster order, matching the reference.
    """
    mask = (prob >= DETECT_THRESHOLD).reshape(shape)
    if not mask.any():
        return np.empty(0, dtype=np.int64)
    lab, count = ndimage.label(mask, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]]))
    sizes = ndimage.sum_labels(mask, lab, index=np.arange(1, count + 1))
    best = int(np.argmax(sizes)) + 1        # argmax keeps the first maximum
    return np.flatnonzero(lab.reshape(-1) == best)


def detect_chip(chip: Chip, detector: Detector | None = None) -> Optional[dict]:
    """Run the classifier over a chip and summarise the strongest blob.

    Returns ``None`` when nothing survives -- that is a clean "no detection",
    not an error. The chip keeps its probability map either way so the console
    can show what the model saw.
    """
    det = detector or get_detector()
    px = chip.bands.T.astype(np.float64)          # (576, 6)
    p = det.proba(px)
    chip.prob = p[:, 0].astype(np.float32)
    chip.cls = np.argmax(p, axis=1).astype(np.uint8)

    comp = _largest_component(chip.prob.astype(np.float64))
    if comp.size < MIN_COMPONENT_PX:
        return None
    q = float(chip.prob[comp].mean())
    band_fdi = features(px[comp])[:, 6]
    return {
        "q": q,
        "px": int(comp.size),
        "area_m2": float(comp.size * PIXEL_AREA_M2),
        "fdi": float(band_fdi.mean()),
    }


# ---------------------------------------------------------------- GeoTIFF
def detect_geotiff(data: bytes, filename: str = "upload.tif") -> dict:
    """Run the same detector over an uploaded 6-band GeoTIFF.

    Band order must be B2, B3, B4, B6, B8, B11 as surface reflectance (0-1); a
    0-10000 scaled product is rescaled automatically. ``rasterio`` is an
    optional dependency -- without it this endpoint reports what to install
    rather than failing silently.
    """
    try:
        import rasterio  # type: ignore
    except ImportError as exc:  # pragma: no cover - depends on the environment
        raise RuntimeError(
            "GeoTIFF upload needs rasterio. Install it with "
            "`pip install rasterio` in the backend environment."
        ) from exc

    with rasterio.open(io.BytesIO(data)) as src:
        if src.count < 6:
            raise ValueError(
                f"expected at least 6 bands (B2 B3 B4 B6 B8 B11), found {src.count}"
            )
        arr = src.read(indexes=[1, 2, 3, 4, 5, 6]).astype(np.float64)
        bounds = src.bounds
        crs = str(src.crs) if src.crs else None
        transform = src.transform

    if np.nanmax(arr) > 1.5:            # scaled integer reflectance
        arr = arr / 10000.0
    arr = np.nan_to_num(arr, nan=0.0)

    nb, h, w = arr.shape
    det = get_detector()
    p = det.debris_proba(arr.reshape(nb, -1).T).astype(np.float32)
    mask = (p >= DETECT_THRESHOLD).reshape(h, w)
    lab, count = ndimage.label(mask, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]]))

    blobs = []
    if count:
        sizes = ndimage.sum_labels(mask, lab, index=np.arange(1, count + 1))
        centres = ndimage.center_of_mass(mask, lab, index=np.arange(1, count + 1))
        px_area = abs(transform.a * transform.e) or PIXEL_AREA_M2
        order = np.argsort(-sizes)[:10]
        for k in order:
            if sizes[k] < MIN_COMPONENT_PX:
                continue
            sel = lab.reshape(-1) == k + 1
            row, col = centres[k]
            lon, lat = transform * (col + 0.5, row + 0.5)
            blobs.append({
                "px": int(sizes[k]),
                "area_m2": round(float(sizes[k] * px_area), 1),
                "mean_probability": round(float(p[sel].mean()), 4),
                "mean_fdi": round(float(features(arr.reshape(nb, -1).T[sel])[:, 6].mean()), 5),
                "centre": {"x": round(float(lon), 6), "y": round(float(lat), 6)},
            })

    # keep the response small: downsample the probability map to a 64 px preview
    stride = max(1, max(h, w) // 64)
    preview = p.reshape(h, w)[::stride, ::stride]
    return {
        "filename": filename,
        "width": w,
        "height": h,
        "bands": BANDS,
        "crs": crs,
        "bounds": [bounds.left, bounds.bottom, bounds.right, bounds.top],
        "detections": blobs,
        "pixels_above_threshold": int(mask.sum()),
        "probability_preview": {
            "width": int(preview.shape[1]),
            "height": int(preview.shape[0]),
            "values": [round(float(v), 3) for v in preview.reshape(-1)],
        },
        "note": "Detector output only; no tracking is applied to an ad-hoc upload.",
    }
