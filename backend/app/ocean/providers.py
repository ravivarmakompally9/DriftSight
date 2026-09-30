"""Surface current and wind fields.

The prototype ships a synthetic South-West-monsoon circulation so the whole
replay is reproducible offline. It is *simulated*, never a measurement -- every
screen that shows it says so. `CMEMSProvider` and `ERA5Provider` are the
switch-over points for real data and carry the concrete TODOs for that work.

All providers return metres per second in (east, north) components.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np

from app.geo.coast import KM_LAT, km_lon

# West India Coastal Current: equatorward during the SW monsoon, axis ~15-25 km
# offshore, wrapping Cape Comorin into the Gulf of Mannar.
AXIS = [
    [76.00, 10.60], [76.02, 9.85], [76.10, 9.30], [76.28, 8.92], [76.60, 8.55],
    [77.00, 8.20], [77.40, 7.96], [77.75, 7.98], [78.05, 8.25], [78.32, 8.62],
    [78.70, 8.95], [79.10, 9.10], [79.45, 9.12],
]

_AX = np.array([[(lo - 76.0) * km_lon(8.6), (la - 8.6) * KM_LAT] for lo, la in AXIS])
_SEG_X = _AX[:-1, 0]
_SEG_Y = _AX[:-1, 1]
_SEG_DX = _AX[1:, 0] - _AX[:-1, 0]
_SEG_DY = _AX[1:, 1] - _AX[:-1, 1]
_SEG_L = np.hypot(_SEG_DX, _SEG_DY)
_SEG_S0 = np.concatenate([[0.0], np.cumsum(_SEG_L)[:-1]])
_AXLEN = float(_SEG_L.sum())


@dataclass(frozen=True)
class FieldParams:
    """One parameter set for the analytic circulation.

    TRUTH is the ocean the debris actually experiences; FORECAST is the slightly
    different field DriftSight predicts with -- that mismatch is what the
    Bayesian tracker has to survive.
    """

    U0: float      # peak along-axis speed, m/s
    L: float       # cross-axis e-folding width, km
    Ub: float      # background along-axis speed, m/s
    A: float       # mesoscale eddy amplitude, m/s
    Ek: float      # offshore Ekman (upwelling) drift, m/s
    kx: float      # eddy wavenumber, 1/km
    ky: float
    om: float      # eddy angular frequency, rad/h
    ph: float      # eddy phase
    W0: float      # mean 10 m wind speed, m/s
    wang: float    # wind direction at t=0, rad
    wph: float     # wind phase
    tide: float    # semidiurnal tidal amplitude, m/s


TRUTH = FieldParams(U0=0.36, L=32, Ub=0.06, A=0.05, Ek=0.035, kx=1 / 38, ky=1 / 29,
                    om=2 * np.pi / 96, ph=0.4, W0=7.0, wang=-0.22, wph=0.0, tide=0.03)
FORECAST = FieldParams(U0=0.33, L=36, Ub=0.05, A=0.04, Ek=0.03, kx=1 / 42, ky=1 / 31,
                       om=2 * np.pi / 110, ph=1.1, W0=6.6, wang=-0.16, wph=0.5, tide=0.03)


class OceanProvider(Protocol):
    """What the drift model needs from any data source, real or simulated."""

    simulated: bool
    name: str

    def current(self, lon, lat, t: float): ...
    def wind(self, t: float): ...


class SyntheticMonsoonProvider:
    """Analytic coastal jet + Ekman drift + mesoscale eddies + semidiurnal tide.

    Vectorised: ``lon``/``lat`` may be scalars or arrays of any matching shape.
    """

    simulated = True

    def __init__(self, params: FieldParams = FORECAST, name: str = "synthetic-monsoon"):
        self.p = params
        self.name = name

    def current(self, lon, lat, t: float):
        p = self.p
        lon = np.asarray(lon, dtype=np.float64)
        lat = np.asarray(lat, dtype=np.float64)
        x = (lon - 76.0) * km_lon(8.6)
        y = (lat - 8.6) * KM_LAT

        # nearest point on the current axis (first segment wins ties, as in the
        # reference implementation)
        xx = x[..., None] if x.ndim else x[None]
        yy = y[..., None] if y.ndim else y[None]
        u = ((xx - _SEG_X) * _SEG_DX + (yy - _SEG_Y) * _SEG_DY) / (_SEG_L * _SEG_L)
        u = np.clip(u, 0.0, 1.0)
        px = _SEG_X + u * _SEG_DX
        py = _SEG_Y + u * _SEG_DY
        d = np.hypot(xx - px, yy - py)
        k = np.argmin(d, axis=-1)
        bd = np.take_along_axis(d, k[..., None], -1)[..., 0]
        tx = _SEG_DX[k] / _SEG_L[k]
        ty = _SEG_DY[k] / _SEG_L[k]
        s = _SEG_S0[k] + np.take_along_axis(u, k[..., None], -1)[..., 0] * _SEG_L[k]

        rem = _AXLEN - s
        taper = np.where(rem < 70, 0.25 + 0.75 * rem / 70.0, 1.0)

        sp = p.U0 * np.exp(-((bd / p.L) ** 2)) * taper + p.Ub * taper
        cu = sp * tx
        cv = sp * ty

        # monsoon upwelling: offshore Ekman drift on the right-hand normal
        ek = p.Ek * np.exp(-((bd / 45.0) ** 2))
        cu = cu + ek * ty
        cv = cv - ek * tx

        # divergence-free mesoscale eddies from a streamfunction
        ax = p.kx * x + p.om * t
        ay = p.ky * y + p.ph
        cu = cu + p.A * np.sin(ax) * (-np.sin(ay))
        cv = cv - p.A * np.cos(ax) * np.cos(ay) * (p.kx / p.ky)

        # semidiurnal tide, roughly cross-shore
        tc = p.tide * np.cos(2.0 * np.pi * t / 12.42)
        cu = cu + tc * 0.8
        cv = cv + tc * 0.3

        if np.ndim(lon) == 0:
            return float(np.reshape(cu, ())), float(np.reshape(cv, ()))
        return cu, cv

    def wind(self, t: float):
        p = self.p
        d = t / 24.0
        sp = p.W0 + 2.2 * np.sin(2 * np.pi * d / 3.1 + p.wph) + 1.0 * np.sin(2 * np.pi * t / 24.0)
        a = p.wang + 0.085 * d + 0.22 * np.sin(2 * np.pi * d / 4.3 + p.wph)
        return float(sp * np.cos(a)), float(sp * np.sin(a))


class CMEMSProvider:
    """Copernicus Marine surface currents (GLOBAL_ANALYSISFORECAST_PHY_001_024).

    Not wired up in the prototype -- it is the first thing to switch on for a
    real deployment. Steps:

    TODO(real-data) 1. ``pip install copernicusmarine`` and store CMEMS
        credentials outside the repo (env vars ``COPERNICUSMARINE_SERVICE_USERNAME``
        / ``_PASSWORD`` or the toolbox's own login file). Never commit them.
    TODO(real-data) 2. ``copernicusmarine.subset(dataset_id=..., variables=["uo","vo"],
        minimum_longitude=74.8, maximum_longitude=80.6, minimum_latitude=6.8,
        maximum_latitude=11.0, minimum_depth=0, maximum_depth=1)`` for the
        incident window, cached to NetCDF under ``backend/data/cmems/``.
    TODO(real-data) 3. Open with xarray, build a
        ``scipy.interpolate.RegularGridInterpolator`` over (time, lat, lon) and
        return ``uo``/``vo`` at the requested hour; fall back to the nearest
        valid ocean cell when a particle sits on a masked grid point.
    TODO(real-data) 4. Blend with the INCOIS regional forecast where it is
        available -- it resolves the West India Coastal Current better than the
        1/12 deg global product.
    """

    simulated = False
    name = "cmems"

    def __init__(self, dataset_id: str = "cmems_mod_glo_phy-cur_anfc_0.083deg_PT1H-i"):
        self.dataset_id = dataset_id

    def current(self, lon, lat, t: float):  # pragma: no cover - stub
        raise NotImplementedError("CMEMS provider is a stub; see the TODOs in this class.")

    def wind(self, t: float):  # pragma: no cover - stub
        raise NotImplementedError("CMEMS carries no wind; pair it with ERA5Provider.")


class ERA5Provider:
    """ERA5 single-level 10 m winds (u10 / v10) from the Copernicus CDS.

    TODO(real-data) 1. ``pip install cdsapi`` and put the CDS key in
        ``~/.cdsapirc`` (never in the repo).
    TODO(real-data) 2. ``cdsapi.Client().retrieve("reanalysis-era5-single-levels",
        {"variable": ["10m_u_component_of_wind", "10m_v_component_of_wind"],
         "area": [11.0, 74.8, 6.8, 80.6], "time": [...], "format": "netcdf"})``.
    TODO(real-data) 3. Interpolate to the particle positions and multiply by the
        per-particle windage coefficient already carried in ``ParticleSet.windage``.
    TODO(real-data) 4. For anything near real time, swap ERA5 for GFS or the
        IMD forecast -- ERA5 lags by about five days.
    """

    simulated = False
    name = "era5"

    def current(self, lon, lat, t: float):  # pragma: no cover - stub
        raise NotImplementedError("ERA5 carries no currents; pair it with CMEMSProvider.")

    def wind(self, t: float):  # pragma: no cover - stub
        raise NotImplementedError("ERA5 provider is a stub; see the TODOs in this class.")


TRUTH_PROVIDER = SyntheticMonsoonProvider(TRUTH, "synthetic-monsoon-truth")
FORECAST_PROVIDER = SyntheticMonsoonProvider(FORECAST, "synthetic-monsoon-forecast")


def get_provider(kind: str = "synthetic") -> OceanProvider:
    kind = (kind or "synthetic").lower()
    if kind == "synthetic":
        return FORECAST_PROVIDER
    if kind == "cmems":
        return CMEMSProvider()
    if kind == "era5":
        return ERA5Provider()
    raise ValueError(f"unknown ocean provider: {kind}")
