"""A NumPy port of the prototype's mulberry32 generator.

The JavaScript engine seeds every stochastic part of the scenario with this
generator, so porting it exactly is what lets the Python backend reproduce the
reference replay particle for particle. Its state is a plain additive counter
(``a += 0x6D2B79F5`` per call) followed by a hash, which means the n-th output
is a pure function of n -- so the whole stream can be produced in one vectorised
shot instead of a Python loop, without changing a single value.
"""
from __future__ import annotations

import numpy as np

_STEP = np.uint32(0x6D2B79F5)
_TWO32 = 4294967296.0


def _hash(a: np.ndarray) -> np.ndarray:
    """mulberry32 finaliser on the already-advanced counter (uint32 in, uint32 out)."""
    t = a ^ (a >> np.uint32(15))
    t = (t * (a | np.uint32(1))).astype(np.uint32)
    t = ((t + (t ^ (t >> np.uint32(7))) * (t | np.uint32(61))).astype(np.uint32)) ^ t
    return (t ^ (t >> np.uint32(14))).astype(np.uint32)


class Rng:
    """Deterministic stream, bit-compatible with ``rng(seed)`` in engine.js."""

    __slots__ = ("_a0", "_n")

    def __init__(self, seed: int):
        self._a0 = np.uint32(seed & 0xFFFFFFFF)
        self._n = 0  # number of values already drawn

    @property
    def draws(self) -> int:
        return self._n

    def raw(self, count: int) -> np.ndarray:
        """The next ``count`` uniforms in [0, 1) as float64."""
        if count <= 0:
            return np.empty(0, dtype=np.float64)
        k = np.arange(self._n + 1, self._n + count + 1, dtype=np.uint32)
        a = (self._a0 + k * _STEP).astype(np.uint32)
        self._n += count
        return _hash(a).astype(np.float64) / _TWO32

    def next(self) -> float:
        return float(self.raw(1)[0])

    def gauss(self, count: int = 1) -> np.ndarray:
        """Box-Muller normals in the same draw order as ``gauss(r)`` in engine.js.

        Each normal eats two uniforms: the radius sample (redrawn on an exact
        zero, as the original does) and the angle sample.
        """
        if count <= 0:
            return np.empty(0, dtype=np.float64)
        u = self.raw(2 * count)
        rad, ang = u[0::2], u[1::2]
        if np.any(rad == 0.0):  # ~2^-32 per draw; keep the original's retry loop
            rad = rad.copy()
            for i in np.flatnonzero(rad == 0.0):
                while rad[i] == 0.0:
                    rad[i] = self.next()
        return np.sqrt(-2.0 * np.log(rad)) * np.cos(2.0 * np.pi * ang)

    def gauss1(self) -> float:
        return float(self.gauss(1)[0])
