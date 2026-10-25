from __future__ import annotations

import json
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlmodel import Session, select

from app.core.db import get_session
from app.core.dependencies import get_current_user, get_kitchen_membership_or_403, require_membership_role
from app.models import (
    BillDefaultSplitParticipantTable,
    BillItemSplitTable,
    BillItemTable,
    BillParticipantTable,
    BillTable,
    KitchenMembershipTable,
    KitchenTable,
    UserTable,
    utc_now,
)
from app.schemas.bill import BillPayload, ItemPayload, SplitPreviewRequest
from app.services.split import calculate_split, validate_participants

router = APIRouter(prefix="/kitchens", tags=["bills"])


def _membership_map(session: Session, kitchen_id: int) -> dict[str, KitchenMembershipTable]:
    memberships = session.exec(select(KitchenMembershipTable).where(KitchenMembershipTable.kitchen_id == kitchen_id)).all()
    user_ids = [membership.user_id for membership in memberships]
    users = {
        user.id: user
        for user in (
            session.exec(select(UserTable).where(UserTable.id.in_(user_ids))).all()
            if user_ids
            else []
        )
    }
    return {
        users[membership.user_id].username: membership
        for membership in memberships
        if membership.user_id in users
    }


def _serialize_bills(session: Session, bills: list[BillTable]) -> list[dict]:
    if not bills:
        return []
    bill_ids = [bill.id for bill in bills]
    participants = defaultdict(list)
    default_between = defaultdict(list)
    items = defaultdict(list)
    splits = defaultdict(list)
    membership_ids = {bill.default_payer_membership_id for bill in bills}

    # One query per collection, rather than one query per bill or item.
    for row in session.exec(select(BillParticipantTable).where(BillParticipantTable.bill_id.in_(bill_ids)).order_by(BillParticipantTable.id)).all():
        participants[row.bill_id].append(row.membership_id)
        membership_ids.add(row.membership_id)
    for row in session.exec(select(BillDefaultSplitParticipantTable).where(BillDefaultSplitParticipantTable.bill_id.in_(bill_ids)).order_by(BillDefaultSplitParticipantTable.id)).all():
        default_between[row.bill_id].append(row.membership_id)
        membership_ids.add(row.membership_id)
    for item in session.exec(select(BillItemTable).where(BillItemTable.bill_id.in_(bill_ids)).order_by(BillItemTable.id)).all():
        items[item.bill_id].append(item)
        membership_ids.add(item.paid_by_membership_id)
    for row in session.exec(
        select(BillItemSplitTable).join(BillItemTable, BillItemSplitTable.item_id == BillItemTable.id)
        .where(BillItemTable.bill_id.in_(bill_ids)).order_by(BillItemSplitTable.id)
    ).all():
        splits[row.item_id].append(row.membership_id)
        membership_ids.add(row.membership_id)
    usernames = dict(session.exec(
        select(KitchenMembershipTable.id, UserTable.username)
        .join(UserTable, KitchenMembershipTable.user_id == UserTable.id)
        .where(KitchenMembershipTable.id.in_(membership_ids))
    ).all())

    serialized = []
    for bill in bills:
        participant_names = [usernames.get(member_id, "") for member_id in participants[bill.id]]
        serialized_items = [
            {
                "name": item.name,
                "price": item.price,
                "paidBy": usernames.get(item.paid_by_membership_id, ""),
                "splitType": item.split_type,
                "splitBetween": [usernames.get(member_id, "") for member_id in splits[item.id]],
            }
            for item in items[bill.id]
        ]
        result = calculate_split(participant_names, [ItemPayload(**item) for item in serialized_items]) if serialized_items else None
        serialized.append({
            "dbTripId": bill.id,
            "id": bill.id,
            "date": bill.date,
            "store": bill.store,
            "participants": participant_names,
            "defaultPayer": usernames.get(bill.default_payer_membership_id, ""),
            "defaultSplit": {"type": bill.default_split_type, "between": [usernames.get(member_id, "") for member_id in default_between[bill.id]]},
            "items": serialized_items,
            "status": bill.status,
            "settlementResults": result["settlements"] if result else [],
        })
    return serialized


def _serialize_bill(session: Session, bill: BillTable) -> dict:
    return _serialize_bills(session, [bill])[0]


def _validate_kitchen_people(kitchen_id: int, payload: BillPayload, session: Session) -> dict[str, KitchenMembershipTable]:
    membership_by_name = _membership_map(session, kitchen_id)
    participant_names = validate_participants(payload.participants)
    unknown = [name for name in participant_names if name not in membership_by_name]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown kitchen participants: {', '.join(unknown)}")
    if payload.defaultPayer not in membership_by_name:
        raise HTTPException(status_code=400, detail="Default payer must be a kitchen member")
    if payload.defaultPayer not in participant_names:
        raise HTTPException(status_code=400, detail="Default payer must be included in bill participants")
    default_split = payload.defaultSplit.between if payload.defaultSplit else []
    invalid_default = [name for name in default_split if name not in membership_by_name]
    if invalid_default:
        raise HTTPException(status_code=400, detail=f"Unknown default split participants: {', '.join(invalid_default)}")
    return membership_by_name


def _clear_bill_children(session: Session, bill_id: int) -> None:
    # Delete in foreign-key order with a fixed number of database round trips.
    item_ids = select(BillItemTable.id).where(BillItemTable.bill_id == bill_id)
    session.exec(delete(BillItemSplitTable).where(BillItemSplitTable.item_id.in_(item_ids)))
    session.exec(delete(BillItemTable).where(BillItemTable.bill_id == bill_id))
    session.exec(delete(BillDefaultSplitParticipantTable).where(BillDefaultSplitParticipantTable.bill_id == bill_id))
    session.exec(delete(BillParticipantTable).where(BillParticipantTable.bill_id == bill_id))


def _persist_bill_payload(
    session: Session,
    bill: BillTable,
    payload: BillPayload,
    membership_by_name: dict[str, KitchenMembershipTable],
) -> None:
    # Snapshot IDs and food preferences once, before any writes/expiration.
    membership_ids = {name: membership.id for name, membership in membership_by_name.items()}
    user_ids = [membership.user_id for membership in membership_by_name.values()]
    foods_by_user = {}
    for user_id, raw_foods in session.exec(select(UserTable.id, UserTable.avoided_foods).where(UserTable.id.in_(user_ids))).all():
        try:
            foods_by_user[user_id] = json.loads(raw_foods)
        except (TypeError, json.JSONDecodeError):
            foods_by_user[user_id] = []
    foods_by_name = {name: foods_by_user.get(membership.user_id, []) for name, membership in membership_by_name.items()}

    prepared_items = []
    for item in payload.items:
        if item.paidBy not in membership_ids:
            raise HTTPException(status_code=400, detail=f"Unknown payer {item.paidBy}")
        split_between = item.splitBetween
        split_type = item.splitType.strip()
        if split_type == "all" and not split_between:
            split_between = payload.participants
        elif split_type == item.paidBy and not split_between:
            split_between = [item.paidBy]
        excluded = {
            name for name, foods in foods_by_name.items()
            if any(food.strip().lower() and food.strip().lower() in item.name.lower() for food in foods)
        }
        split_between = [name for name in split_between if name not in excluded]
        if not split_between:
            raise HTTPException(status_code=400, detail=f"No eligible participants remain for {item.name} after food preferences are applied")
        for name in split_between:
            if name not in membership_ids:
                raise HTTPException(status_code=400, detail=f"Unknown split participant {name}")
        prepared_items.append((item, split_between))

    bill.date = payload.date
    bill.store = payload.store
    bill.default_payer_membership_id = membership_ids[payload.defaultPayer]
    bill.default_split_type = payload.defaultSplit.type if payload.defaultSplit else "all"
    bill.updated_at = utc_now()
    session.add(bill)
    session.add_all([
        BillParticipantTable(bill_id=bill.id, membership_id=membership_ids[name])
        for name in payload.participants
    ])
    default_between = payload.defaultSplit.between if payload.defaultSplit else []
    if bill.default_split_type == "all" and not default_between:
        default_between = payload.participants
    session.add_all([
        BillDefaultSplitParticipantTable(bill_id=bill.id, membership_id=membership_ids[name])
        for name in default_between
    ])
    bill_items = [
        BillItemTable(bill_id=bill.id, name=item.name.strip(), price=item.price,
                      paid_by_membership_id=membership_ids[item.paidBy], split_type=item.splitType.strip())
        for item, _ in prepared_items
    ]
    session.add_all(bill_items)
    session.flush()  # Populate all item IDs together; do not commit per item.
    session.add_all([
        BillItemSplitTable(item_id=bill_item.id, membership_id=membership_ids[name])
        for bill_item, (_, split_between) in zip(bill_items, prepared_items)
        for name in split_between
    ])
    session.commit()


@router.post("/{kitchen_id}/split-preview")
def split_preview(
    kitchen_id: int,
    data: SplitPreviewRequest,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    items = data.items or ([data.item] if data.item else [])
    return {"message": "Split processed successfully", "result": calculate_split(data.initialInputs, items)}


@router.get("/{kitchen_id}/bills")
def list_bills(
    kitchen_id: int,
    mine: bool = False,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    kitchen = session.get(KitchenTable, kitchen_id)
    if not kitchen:
        raise HTTPException(status_code=404, detail="Kitchen not found")
    statement = select(BillTable).where(BillTable.kitchen_id == kitchen_id)
    if mine:
        statement = statement.where(BillTable.created_by_user_id == current_user.id)
    bills = session.exec(statement).all()
    return {"trips": _serialize_bills(session, bills)}


@router.post("/{kitchen_id}/bills")
def create_bill(
    kitchen_id: int,
    payload: BillPayload,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    membership_by_name = _validate_kitchen_people(kitchen_id, payload, session)
    bill = BillTable(
        kitchen_id=kitchen_id,
        created_by_user_id=current_user.id,
        date=payload.date,
        store=payload.store,
        default_payer_membership_id=membership_by_name[payload.defaultPayer].id,
        default_split_type=payload.defaultSplit.type if payload.defaultSplit else "all",
    )
    session.add(bill)
    session.flush()
    _persist_bill_payload(session, bill, payload, membership_by_name)
    serialized = _serialize_bill(session, bill)
    return {"message": "Bill saved successfully", "tripId": bill.id, "trip": serialized, "settlementResults": serialized["settlementResults"]}


@router.put("/{kitchen_id}/bills/{bill_id}")
def update_bill(
    kitchen_id: int,
    bill_id: int,
    payload: BillPayload,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    membership = get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    bill = session.get(BillTable, bill_id)
    if not bill or bill.kitchen_id != kitchen_id:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.created_by_user_id != current_user.id:
        require_membership_role(membership, {"owner", "admin"})
    membership_by_name = _validate_kitchen_people(kitchen_id, payload, session)
    _clear_bill_children(session, bill_id)
    _persist_bill_payload(session, bill, payload, membership_by_name)
    serialized = _serialize_bill(session, bill)
    return {"message": "Bill updated successfully", "tripId": bill.id, "trip": serialized, "settlementResults": serialized["settlementResults"]}


@router.delete("/{kitchen_id}/bills/{bill_id}")
def delete_bill(
    kitchen_id: int,
    bill_id: int,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    membership = get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    bill = session.get(BillTable, bill_id)
    if not bill or bill.kitchen_id != kitchen_id:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.created_by_user_id != current_user.id:
        require_membership_role(membership, {"owner", "admin"})
    _clear_bill_children(session, bill.id)
    session.delete(bill)
    session.commit()
    return {"message": "Bill deleted successfully", "tripId": bill_id}
