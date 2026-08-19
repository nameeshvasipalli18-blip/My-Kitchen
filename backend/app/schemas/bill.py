from __future__ import annotations

from pydantic import BaseModel, Field


class SplitTypePayload(BaseModel):
    type: str
    between: list[str] = Field(default_factory=list)


class ItemPayload(BaseModel):
    name: str
    price: float
    paidBy: str
    splitType: str
    splitBetween: list[str] = Field(default_factory=list)


class SplitPreviewRequest(BaseModel):
    initialInputs: list[str]
    item: ItemPayload | None = None
    items: list[ItemPayload] = Field(default_factory=list)


class BillPayload(BaseModel):
    id: int | None = None
    date: str
    store: str
    participants: list[str]
    defaultPayer: str
    defaultSplit: SplitTypePayload | None = None
    items: list[ItemPayload] = Field(default_factory=list)
