"""Tiny PNG previews of image chips.

The chips are the one genuinely visual asset DriftSight has -- actual pixels a
person can look at and judge. Shrinking them to a thumbnail makes a list of
detections scannable at a glance instead of a wall of coordinates.

Written by hand against zlib rather than pulling in an imaging library: a
24x24 RGB PNG is a few hundred bytes, and the encoder is short enough to read.
"""
from __future__ import annotations

import base64
import struct
import zlib

import numpy as np

# The same gamma stretch the browser applies, so a thumbnail and the full chip
# in the detail panel are the same picture.
_GAMMA = 0.7
_SCALE = 0.16


def _chunk(tag: bytes, data: bytes) -> bytes:
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def encode_png(rgb: np.ndarray) -> bytes:
    """(h, w, 3) uint8 -> PNG bytes."""
    h, w, _ = rgb.shape
    raw = b"".join(b"\x00" + rgb[y].tobytes() for y in range(h))
    return (b"\x89PNG\r\n\x1a\n"
            + _chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + _chunk(b"IDAT", zlib.compress(raw, 9))
            + _chunk(b"IEND", b""))


def _stretch(band: np.ndarray) -> np.ndarray:
    return np.clip(np.power(np.clip(band, 0, None) / _SCALE, _GAMMA) * 255, 0, 255)


def true_colour_png(chip) -> str:
    """B4/B3/B2 composite as a `data:` URI, ready for an <img src>."""
    n = chip.size
    r = _stretch(chip.bands[2].astype(np.float64)).reshape(n, n)
    g = _stretch(chip.bands[1].astype(np.float64)).reshape(n, n)
    b = _stretch(chip.bands[0].astype(np.float64)).reshape(n, n)
    rgb = np.stack([r, g, b], axis=-1).astype(np.uint8)
    return "data:image/png;base64," + base64.b64encode(encode_png(rgb)).decode()


def probability_png(chip) -> str:
    """The classifier's P(debris) map, in the same ramp the console uses."""
    n = chip.size
    p = chip.prob.astype(np.float64).reshape(n, n)
    r = np.clip(25 + 225 * p, 0, 255)
    g = np.clip(40 + 120 * p * (1 - p) * 2 + 30 * p, 0, 255)
    b = np.clip(90 * (1 - p) + 30, 0, 255)
    rgb = np.stack([r, g, b], axis=-1).astype(np.uint8)
    return "data:image/png;base64," + base64.b64encode(encode_png(rgb)).decode()
