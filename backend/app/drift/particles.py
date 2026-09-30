"""Vectorised Lagrangian particle sets.

One hour per step: RK2 advection through the ocean provider, plus a windage
fraction of the 10 m wind, plus a random walk for unresolved turbulence.
Particles that hit the land mask beach and stop; particles that leave the
domain are dropped.

Positions are held as float32 -- the same precision the reference prototype
uses -- so a run here reproduces the reference trajectories exactly.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.core.rng import Rng
from app.geo.coast import KM_LAT, km_lon, geo

AFLOAT, BEACHED, LOST, HELD = 0, 1, 2, 3
STATE_NAMES = {AFLOAT: "afloat", BEACHED: "ashore", LOST: "left-domain", HELD: "not-yet-released"}


@dataclass
class ParticleSet:
    x: np.ndarray           # float32 longitude
    y: np.ndarray           # float32 latitude
    windage: np.ndarray     # float32 fraction of wind speed added to the drift
    state: np.ndarray       # uint8, see the constants above
    beach_hour: np.ndarray  # float32, -1 while afloat
    release: np.ndarray = field(default=None)  # float32 hour each particle enters the water

    def __post_init__(self):
        if self.release is None:
            self.release = np.zeros(len(self.x), dtype=np.float32)

    def __len__(self) -> int:
        return int(len(self.x))

    def copy(self) -> "ParticleSet":
        return ParticleSet(self.x.copy(), self.y.copy(), self.windage.copy(),
                           self.state.copy(), self.beach_hour.copy(), self.release.copy())

    # ---- summaries ---------------------------------------------------
    def count(self, state: int) -> int:
        return int(np.count_nonzero(self.state == state))

    def stats(self) -> dict:
        """Centroid and 1-sigma spread of the still-floating particles."""
        m = self.state == AFLOAT
        n = int(np.count_nonzero(m))
        if n == 0:
            return {"n": 0, "lon": float("nan"), "lat": float("nan"),
                    "sd_km": 0.0, "beached": self.count(BEACHED)}
        xs = self.x[m].astype(np.float64)
        ys = self.y[m].astype(np.float64)
        mx, my = xs.mean(), ys.mean()
        dx = (xs - mx) * km_lon(my)
        dy = (ys - my) * KM_LAT
        var = float((dx * dx + dy * dy).sum())
        return {"n": n, "lon": float(mx), "lat": float(my),
                "sd_km": float(np.sqrt(var / n / 2.0)), "beached": self.count(BEACHED)}


def make_set(n: int, lon: float, lat: float, sd_km: float,
             windage_lo: float, windage_hi: float, rng: Rng) -> ParticleSet:
    """Seed ``n`` particles around a point, rejecting positions that land ashore.

    Rejection is per particle and sequential because that is what fixes the draw
    order; ``n`` is a few hundred to a few thousand, so the loop is cheap.
    """
    g = geo()
    xs = np.empty(n, dtype=np.float32)
    ys = np.empty(n, dtype=np.float32)
    wa = np.empty(n, dtype=np.float32)
    kx = sd_km / float(km_lon(lat))
    ky = sd_km / KM_LAT
    for i in range(n):
        tries = 0
        while True:
            lo = lon + rng.gauss1() * kx
            la = lat + rng.gauss1() * ky
            if not g.is_land(lo, la):
                break
            tries += 1
            if tries >= 20:
                break
        xs[i] = lo
        ys[i] = la
        wa[i] = windage_lo + (windage_hi - windage_lo) * rng.next()
    return ParticleSet(
        x=xs, y=ys, windage=wa,
        state=np.zeros(n, dtype=np.uint8),
        beach_hour=np.full(n, -1.0, dtype=np.float32),
        release=np.zeros(n, dtype=np.float32),
    )


def step(P: ParticleSet, t: float, provider, rng: Rng, direction: int = 1,
         diffusivity: float = 12.0) -> None:
    """Advance the set by one hour (``direction=-1`` runs the model backwards).

    Backward mode is what the "trace to source" button uses: it reverses the
    advection, keeps the diffusion, and lets particles slide along the coast
    instead of beaching.
    """
    g = geo()
    live = np.flatnonzero(P.state == AFLOAT)
    k = live.size
    if k == 0:
        return

    dt = 3600.0 * direction
    sigma = np.sqrt(2.0 * diffusivity * 3600.0)
    wu, wv = provider.wind(t)

    lo = P.x[live].astype(np.float64)
    la = P.y[live].astype(np.float64)
    a = P.windage[live].astype(np.float64)

    # --- RK2: velocity at the start, then at the half-step midpoint -----
    u, v = provider.current(lo, la, t)
    mlo = lo + (u + a * wu) * dt / 2.0 / (km_lon(la) * 1000.0)
    mla = la + (v + a * wv) * dt / 2.0 / (KM_LAT * 1000.0)
    u, v = provider.current(mlo, mla, t + direction * 0.5)

    # --- random walk: two normals per particle, in particle order -------
    raws = rng.raw(4 * k).reshape(k, 4)
    rad = raws[:, [0, 2]]
    ang = raws[:, [1, 3]]
    if np.any(rad == 0.0):  # vanishingly rare; keep the reference's retry
        rad = np.where(rad == 0.0, np.nextafter(0.0, 1.0), rad)
    gn = np.sqrt(-2.0 * np.log(rad)) * np.cos(2.0 * np.pi * ang)

    dx = (u + a * wu) * dt + gn[:, 0] * sigma
    dy = (v + a * wv) * dt + gn[:, 1] * sigma
    nlo = lo + dx / (km_lon(la) * 1000.0)
    nla = la + dy / (KM_LAT * 1000.0)

    out = ~g.in_box(nlo, nla)
    land = g.is_land(nlo, nla) & ~out

    if direction > 0:
        beach = land
        move = ~out & ~land
        if np.any(beach):
            idx = live[beach]
            P.state[idx] = BEACHED
            P.beach_hour[idx] = t + 1
            P.x[idx] = (lo[beach] + nlo[beach]) / 2.0
            P.y[idx] = (la[beach] + nla[beach]) / 2.0
    else:
        move = ~out & ~land  # backward: a step onto land is simply refused

    if np.any(out):
        P.state[live[out]] = LOST
    if np.any(move):
        idx = live[move]
        P.x[idx] = nlo[move]
        P.y[idx] = nla[move]


def advect(P: ParticleSet, hours: int, t0: float, provider, rng: Rng,
           direction: int = 1, diffusivity: float = 12.0) -> None:
    for i in range(hours):
        step(P, t0 + direction * i, provider, rng, direction, diffusivity)
