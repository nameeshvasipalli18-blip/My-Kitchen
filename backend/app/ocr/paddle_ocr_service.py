from __future__ import annotations

import os
import tempfile
from collections.abc import Iterable, Mapping
from io import BytesIO
from typing import Any

from PIL import Image, ImageOps


class OcrServiceUnavailableError(RuntimeError):
    """Raised when PaddleOCR is unavailable in the running environment."""


_ocr_engine: Any | None = None


def _get_ocr_engine() -> Any:
    global _ocr_engine
    if _ocr_engine is not None:
        return _ocr_engine

    try:
        from paddleocr import PaddleOCR
    except ImportError as error:
        raise OcrServiceUnavailableError("PaddleOCR is not installed.") from error

    _ocr_engine = PaddleOCR(
        lang="en",
        enable_mkldnn=False,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        text_det_limit_side_len=2560,
    )
    return _ocr_engine


def _as_json_value(value: Any) -> Any:
    if callable(value):
        value = value()
    return value


def _as_box(value: Any) -> list[list[float]] | None:
    if not isinstance(value, Iterable) or isinstance(value, (str, bytes, Mapping)):
        return None

    points = []
    for point in value:
        if not isinstance(point, Iterable) or isinstance(point, (str, bytes, Mapping)):
            return None
        coordinates = list(point)
        if len(coordinates) < 2:
            return None
        try:
            points.append([float(coordinates[0]), float(coordinates[1])])
        except (TypeError, ValueError):
            return None
    return points or None


def _normalize_modern_result(result: Any) -> list[dict[str, Any]]:
    payload = _as_json_value(getattr(result, "json", result))
    if not isinstance(payload, Mapping):
        return []

    payload = payload.get("res", payload)
    if not isinstance(payload, Mapping):
        return []

    texts = payload.get("rec_texts")
    boxes = payload.get("rec_polys") or payload.get("rec_boxes")
    scores = payload.get("rec_scores")
    if not isinstance(texts, list) or not isinstance(boxes, list):
        return []

    lines = []
    for index, text in enumerate(texts):
        box = _as_box(boxes[index]) if index < len(boxes) else None
        if not isinstance(text, str) or not text.strip() or box is None:
            continue
        confidence = scores[index] if isinstance(scores, list) and index < len(scores) else None
        lines.append({
            "text": text.strip(),
            "confidence": float(confidence) if confidence is not None else None,
            "box": box,
        })
    return lines


def _normalize_legacy_result(result: Any) -> list[dict[str, Any]]:
    lines = []
    for page in result or []:
        for entry in page or []:
            if not isinstance(entry, list) or len(entry) < 2:
                continue
            box = _as_box(entry[0])
            recognition = entry[1]
            if box is None or not isinstance(recognition, (list, tuple)) or not recognition:
                continue
            text = recognition[0]
            if not isinstance(text, str) or not text.strip():
                continue
            confidence = recognition[1] if len(recognition) > 1 else None
            lines.append({
                "text": text.strip(),
                "confidence": float(confidence) if confidence is not None else None,
                "box": box,
            })
    return lines


def _reading_order(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Rebuild receipt rows from OCR boxes, ordered top-to-bottom and left-to-right."""
    if not lines:
        return []

    positioned_lines = []
    for line in lines:
        box = line.get("box") or []
        if box:
            top = min(point[1] for point in box)
            bottom = max(point[1] for point in box)
            left = min(point[0] for point in box)
        else:
            top = 0.0
            bottom = 0.0
            left = 0.0
        positioned_lines.append((top, bottom, left, line))
    positioned_lines.sort(key=lambda entry: (entry[0], entry[1]))

    rows: list[list[tuple[float, float, float, dict[str, Any]]]] = []
    for entry in positioned_lines:
        if not rows:
            rows.append([entry])
            continue

        row_top = min(row_entry[0] for row_entry in rows[-1])
        row_bottom = max(row_entry[1] for row_entry in rows[-1])
        overlap = max(0.0, min(entry[1], row_bottom) - max(entry[0], row_top))
        smallest_height = min(entry[1] - entry[0], row_bottom - row_top)
        same_row = smallest_height > 0 and overlap / smallest_height >= 0.5
        if same_row:
            rows[-1].append(entry)
        else:
            rows.append([entry])

    merged_lines = []
    for row in rows:
        ordered_row = sorted(row, key=lambda entry: entry[2])
        row_lines = [entry[3] for entry in ordered_row]
        texts = [line["text"] for line in row_lines if line.get("text")]
        boxes = [line["box"] for line in row_lines if line.get("box")]
        confidences = [line["confidence"] for line in row_lines if line.get("confidence") is not None]
        if not texts or not boxes:
            continue

        left = min(point[0] for box in boxes for point in box)
        top = min(point[1] for box in boxes for point in box)
        right = max(point[0] for box in boxes for point in box)
        bottom = max(point[1] for box in boxes for point in box)
        merged_lines.append({
            "text": " ".join(texts),
            "confidence": min(confidences) if confidences else None,
            "box": [[left, top], [right, top], [right, bottom], [left, bottom]],
        })
    return merged_lines


def _prepare_image(image_bytes: bytes) -> bytes:
    """Increase small e-bill images to a readable OCR resolution."""
    with Image.open(BytesIO(image_bytes)) as uploaded_image:
        image = ImageOps.exif_transpose(uploaded_image).convert("RGB")
        target_width = 2400
        if image.width < target_width:
            scale = target_width / image.width
            image = image.resize((target_width, round(image.height * scale)), Image.Resampling.LANCZOS)
        image = ImageOps.autocontrast(image)
        horizontal_padding = max(40, round(image.width * 0.06))
        vertical_padding = max(24, round(image.height * 0.03))
        image = ImageOps.expand(
            image,
            border=(horizontal_padding, vertical_padding, horizontal_padding, vertical_padding),
            fill="white",
        )
        prepared_image = BytesIO()
        image.save(prepared_image, format="PNG", optimize=True)
        return prepared_image.getvalue()


def scan_image(image_bytes: bytes, suffix: str = ".png") -> list[dict[str, Any]]:
    """Run PaddleOCR and return recognized text with its bounding polygons."""
    if not image_bytes:
        return []

    temporary_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary_file:
            temporary_file.write(_prepare_image(image_bytes))
            temporary_path = temporary_file.name

        engine = _get_ocr_engine()
        if hasattr(engine, "predict"):
            result = list(engine.predict(input=temporary_path))
            lines = [line for page in result for line in _normalize_modern_result(page)]
        else:
            lines = _normalize_legacy_result(engine.ocr(temporary_path, cls=True))
        return _reading_order(lines)
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)