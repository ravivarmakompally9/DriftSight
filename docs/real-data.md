# Switching DriftSight to real data

DriftSight's replay runs on simulated imagery and a simulated monsoon
circulation. Nothing in the repo talks to a satellite archive or an ocean model,
and every screen says so. This is the plan for changing that.

Nothing below is wired up. Each item names the exact function or class it lands
in, so the swap is a replacement rather than a rewrite.

**1 · Imagery → Sentinel-2 / Landsat / Sentinel-1.**
Replace `app/detect/chips.make_chip` with a real reader. `detect_geotiff()`
already runs the production path: give it a 6-band GeoTIFF (B2 B3 B4 B6 B8 B11,
reflectance 0–1 or 0–10000) and it returns blobs with areas and centroids in map
coordinates — `pip install rasterio` to enable it. Pull scenes from the
[Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/) (free, STAC +
S3) or Google Earth Engine. Sentinel-1 SAR matters here: this coast is under
monsoon cloud for weeks, and radar sees through it.

**2 · Currents → CMEMS / INCOIS.** `app/ocean/providers.py::CMEMSProvider` carries
step-by-step TODOs: `pip install copernicusmarine`, subset
`GLOBAL_ANALYSISFORECAST_PHY_001_024` over lon 74.8–80.6 E / lat 6.8–11.0 N to
NetCDF, interpolate with `scipy.interpolate.RegularGridInterpolator` over
(time, lat, lon). Blend with the INCOIS regional forecast, which resolves the West
India Coastal Current better than the 1/12° global product. Credentials go in env
vars, never the repo.

**3 · Winds → ERA5 / GFS.** `ERA5Provider` has the `cdsapi` recipe for
`reanalysis-era5-single-levels` 10 m `u10`/`v10`. ERA5 lags about five days, so use
GFS or the IMD forecast for anything near real time. The per-particle windage
coefficient in `ParticleSet.windage` is already the right hook.

**4 · Detector → U-Net.** Replace the logistic regression in
`app/detect/model.py` with a segmentation model trained on
[MARIDA](https://marine-debris.github.io/) and
[MADOS](https://marine-debris.github.io/madosDataset.html) (published F1 ≈ 0.89),
fine-tuned on Indian coastal scenes — and on the field labels this app already
collects in the `field_results` table. `Detector.proba()` is the only interface
the rest of the system uses, so nothing else has to change.

**5 · Validation.** Keep scoring against reported landfall the way
`analysis/forecast.py` does today. A forecast that cannot be checked is not a
forecast.

Switch the provider with `DRIFTSIGHT_OCEAN_PROVIDER=cmems` once implemented; see
`backend/.env.example`.

---

Back to the [README](../README.md).
