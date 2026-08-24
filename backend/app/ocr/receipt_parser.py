from __future__ import annotations

import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Any


_MONEY_PATTERN = re.compile(r"(?<!\d)(?:£\s*)?(\d+\.\d{2})(?!\d)")
_EXCLUDED_LINE_PATTERN = re.compile(
    r"\b(?:subtotal|total|vat|tax|card|cash|payment|change|discount)\b",
    re.IGNORECASE,
)
_WEIGHT_DETAIL_PATTERN = re.compile(r"\b(?:kg|g|lb|oz)\b.*@|@.*\b(?:kg|g|lb|oz)\b", re.IGNORECASE)
_QUANTITY_PATTERN = re.compile(r"\b\d+\s*[xX]\s*(?:£\s*)?\d+\.\d{2}\b")
_QUANTITY_PRICE_PATTERN = re.compile(r"\b(\d+)\s*[xX×]\s*(?:£\s*)?(\d+\.\d{2})\b")
_PRODUCT_CODE_PATTERN = re.compile(r"\b\d{5,}\b")
_LEADING_CODE_PATTERN = re.compile(r"^\d{1,3}\s+")
_TRAILING_CLASSIFICATION_PATTERN = re.compile(r"\s+[A-Z]$")


def _line_text(line: str | dict[str, Any]) -> str:
    return line if isinstance(line, str) else str(line.get("text", ""))


def _money_value(match: re.Match[str]) -> Decimal:
    return Decimal(match.group(1)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _clean_item_name(name: str) -> str:
    name = _QUANTITY_PATTERN.sub("", name)
    name = _PRODUCT_CODE_PATTERN.sub("", name)
    name = _LEADING_CODE_PATTERN.sub("", name)
    name = _TRAILING_CLASSIFICATION_PATTERN.sub("", name)
    return " ".join(name.split())


def _item_name(line: str, price_match: re.Match[str]) -> str:
    return _clean_item_name(line[:price_match.start()])


def _quantity_line_price(line: str) -> Decimal | None:
    quantity_match = _QUANTITY_PRICE_PATTERN.search(line)
    if not quantity_match:
        return None
    quantity = Decimal(quantity_match.group(1))
    unit_price = Decimal(quantity_match.group(2))
    return (quantity * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _is_separator(line: str) -> bool:
    return bool(line) and all(character in "-_=" for character in line)


def parse_receipt(ocr_result: list[str | dict[str, Any]]) -> dict[str, Any]:
    """Extract grocery item names, final line prices, and a receipt total from OCR lines."""
    items: list[dict[str, Any]] = []
    receipt_total: Decimal | None = None
    pending_name = ""

    for raw_line in ocr_result:
        line = " ".join(_line_text(raw_line).split())
        if not line or _is_separator(line):
            continue

        money_matches = list(_MONEY_PATTERN.finditer(line))
        if _EXCLUDED_LINE_PATTERN.search(line):
            if re.search(r"\btotal\b", line, re.IGNORECASE) and money_matches:
                receipt_total = _money_value(money_matches[-1])
            pending_name = ""
            continue

        if _WEIGHT_DETAIL_PATTERN.search(line):
            continue

        if not money_matches:
            pending_name = line
            continue

        quantity_match = _QUANTITY_PRICE_PATTERN.search(line)
        quantity_price = _quantity_line_price(line)
        final_price = quantity_price or _money_value(money_matches[-1])
        name = _clean_item_name(line[:quantity_match.start()]) if quantity_match else _item_name(line, money_matches[-1])
        if not name:
            name = pending_name
        if not name:
            continue

        items.append({"name": name, "price": float(final_price)})
        pending_name = ""

    calculated_total = sum((Decimal(str(item["price"])) for item in items), Decimal("0.00"))
    calculated_total = calculated_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total_matches = (
        receipt_total is not None
        and abs(calculated_total - receipt_total) <= Decimal("0.01")
    )

    return {
        "items": items,
        "total": float(receipt_total) if receipt_total is not None else None,
        "calculated_total": float(calculated_total),
        "total_matches": total_matches,
    }