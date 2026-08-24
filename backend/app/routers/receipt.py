from __future__ import annotations

from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.core.dependencies import get_current_user
from app.models import UserTable
from app.ocr.paddle_ocr_service import OcrServiceUnavailableError, scan_image
from app.ocr.receipt_parser import parse_receipt

router = APIRouter(prefix="/receipt", tags=["receipt"])


def _validate_image(image: UploadFile, image_bytes: bytes) -> None:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload an image file.")
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded image is empty.")

    try:
        with Image.open(BytesIO(image_bytes)) as opened_image:
            opened_image.verify()
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is not a valid image.") from error


@router.post("/scan")
async def scan_receipt(
    image: UploadFile = File(...),
    _current_user: UserTable = Depends(get_current_user),
):
    image_bytes = await image.read()
    _validate_image(image, image_bytes)
    suffix = Path(image.filename or "receipt.png").suffix or ".png"

    try:
        lines = scan_image(image_bytes, suffix)
    except OcrServiceUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Receipt scanning is unavailable.") from error
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not process the uploaded image.") from error
    finally:
        await image.close()

    parsed_receipt = parse_receipt(lines)
    return {
        "lines": lines,
        "text": "\n".join(line["text"] for line in lines),
        **parsed_receipt,
    }