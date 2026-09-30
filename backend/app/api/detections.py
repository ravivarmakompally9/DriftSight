from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.api.deps import require_run
from app.api.serialize import detection_payload
from app.detect.chips import detect_geotiff

router = APIRouter(tags=["detections"])

MAX_UPLOAD_BYTES = 40 * 1024 * 1024


@router.get("/detections/{det_id}", summary="One detection with its image chip")
def get_detection(det_id: int, run_id: str = Query("latest")) -> dict:
    """Includes the six band rasters, the probability map, the mean spectrum of
    the detected pixels, the FDI and the track it was associated with."""
    run = require_run(run_id)
    if det_id < 0 or det_id >= len(run.detections):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No detection {det_id}")
    return detection_payload(run, run.detections[det_id], full=True)


@router.post("/detect/upload", summary="Run the detector on an uploaded GeoTIFF")
async def post_upload(file: UploadFile = File(..., description="6-band GeoTIFF: B2 B3 B4 B6 B8 B11")) -> dict:
    """Same classifier, pointed at a real raster instead of a synthetic chip.

    Reflectance may be 0-1 or 0-10000. Needs the optional `rasterio` dependency.
    """
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty upload")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            f"File larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    try:
        return detect_geotiff(data, file.filename or "upload.tif")
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except Exception as exc:  # malformed raster
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not read the GeoTIFF: {exc}") from exc
