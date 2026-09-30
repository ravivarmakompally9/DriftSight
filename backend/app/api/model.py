from __future__ import annotations

from fastapi import APIRouter

from app.detect.model import get_detector
from app.detect.spectra import BANDS, CLASSES, SPECTRA, WAVELENGTHS
from app.ocean.providers import FORECAST_PROVIDER, TRUTH_PROVIDER

router = APIRouter(tags=["model"])

DATA_SOURCES = [
    {
        "icon": "satellite",
        "name": "Sentinel-2 MSI · Landsat 8/9 · Sentinel-1 SAR",
        "purpose": "Optical 10–30 m; radar sees through cloud",
        "state": "simulated",
        "detail": "Prototype: synthetic chips generated from a spectral library",
        "production": "Copernicus Data Space Ecosystem or Google Earth Engine",
    },
    {
        "icon": "waves",
        "name": "INCOIS ocean forecasts · CMEMS 1/12° currents",
        "purpose": "Surface currents for drift",
        "state": "simulated",
        "detail": "Prototype: analytic monsoon circulation",
        "production": "copernicusmarine toolbox; see CMEMSProvider",
    },
    {
        "icon": "wind",
        "name": "ERA5 / GFS 10 m winds",
        "purpose": "Wind drag on floating debris",
        "state": "simulated",
        "detail": "Prototype: analytic monsoon wind",
        "production": "cdsapi; see ERA5Provider",
    },
    {
        "icon": "database",
        "name": "MARIDA · MADOS",
        "purpose": "Labelled marine-debris training scenes",
        "state": "planned",
        "detail": "Not used in the prototype",
        "production": "U-Net segmentation, published F1 ≈ 0.89",
    },
    {
        "icon": "flag",
        "name": "Reported landfall (INCOIS, news, Mar. Poll. Bull. 2025)",
        "purpose": "Validation of the ELSA 3 replay",
        "state": "used",
        "detail": "Kanyakumari beach survey, 30 May 2025",
        "production": "Same",
    },
]


@router.get("/model", summary="Detector metrics, confusion matrix and spectral library")
def get_model() -> dict:
    det = get_detector()
    rep = det.report()
    rep["bands"] = BANDS
    rep["wavelengths_nm"] = WAVELENGTHS
    rep["spectra"] = SPECTRA
    rep["classes"] = CLASSES
    rep["data_sources"] = DATA_SOURCES
    rep["ocean"] = {
        "provider": FORECAST_PROVIDER.name,
        "simulated": FORECAST_PROVIDER.simulated,
        "truth_params": TRUTH_PROVIDER.p.__dict__,
        "forecast_params": FORECAST_PROVIDER.p.__dict__,
        "note": ("The replay drifts debris through one parameter set and predicts "
                 "with another, so the tracker faces a realistic forecast error."),
    }
    return rep
