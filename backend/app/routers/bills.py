from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
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
    users = {user.id: user for user in session.exec(select(UserTable)).all()}
    return {
        users[membership.user_id].username: membership
        for membership in memberships
        if membership.user_id in users
    }


def _username_for_membership(session: Session, membership_id: int) -> str:
    membership = session.get(KitchenMembershipTable, membership_id)
    if not membership:
        return ""
    user = session.get(UserTable, membership.user_id)
    return user.username if user else ""


def _serialize_bill(session: Session, bill: BillTable) -> dict:
    participants = session.exec(select(BillParticipantTable).where(BillParticipantTable.bill_id == bill.id)).all()
    default_between = session.exec(
        select(BillDefaultSplitParticipantTable).where(BillDefaultSplitParticipantTable.bill_id == bill.id)
    ).all()
    items = session.exec(select(BillItemTable).where(BillItemTable.bill_id == bill.id)).all()

    serialized_items = []
    for item in items:
        split_rows = session.exec(select(BillItemSplitTable).where(BillItemSplitTable.item_id == item.id)).all()
        serialized_items.append(
            {
                "name": item.name,
                "price": item.price,
                "paidBy": _username_for_membership(session, item.paid_by_membership_id),
                "splitType": item.split_type,
                "splitBetween": [_username_for_membership(session, row.membership_id) for row in split_rows],
            }
        )

    participant_names = [_username_for_membership(session, row.membership_id) for row in participants]
    default_between_names = [_username_for_membership(session, row.membership_id) for row in default_between]
    result = calculate_split(participant_names, [ItemPayload(**item) for item in serialized_items]) if serialized_items else None

    return {
        "dbTripId": bill.id,
        "id": bill.id,
        "date": bill.date,
        "store": bill.store,
        "participants": participant_names,
        "defaultPayer": _username_for_membership(session, bill.default_payer_membership_id),
        "defaultSplit": {"type": bill.default_split_type, "between": default_between_names},
        "items": serialized_items,
        "status": bill.status,
        "settlementResults": result["settlements"] if result else [],
    }


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
    default_rows = session.exec(select(BillDefaultSplitParticipantTable).where(BillDefaultSplitParticipantTable.bill_id == bill_id)).all()
    for row in default_rows:
        session.delete(row)
    participant_rows = session.exec(select(BillParticipantTable).where(BillParticipantTable.bill_id == bill_id)).all()
    for row in participant_rows:
        session.delete(row)
    items = session.exec(select(BillItemTable).where(BillItemTable.bill_id == bill_id)).all()
    for item in items:
        split_rows = session.exec(select(BillItemSplitTable).where(BillItemSplitTable.item_id == item.id)).all()
        for split in split_rows:
            session.delete(split)
        session.delete(item)


def _persist_bill_payload(
    session: Session,
    bill: BillTable,
    payload: BillPayload,
    membership_by_name: dict[str, KitchenMembershipTable],
) -> None:
    bill.date = payload.date
    bill.store = payload.store
    bill.default_payer_membership_id = membership_by_name[payload.defaultPayer].id
    bill.default_split_type = payload.defaultSplit.type if payload.defaultSplit else "all"
    bill.updated_at = utc_now()
    session.add(bill)
    session.commit()
    session.refresh(bill)

    for participant_name in payload.participants:
        session.add(BillParticipantTable(bill_id=bill.id, membership_id=membership_by_name[participant_name].id))

    default_between = payload.defaultSplit.between if payload.defaultSplit else []
    if bill.default_split_type == "all" and not default_between:
        default_between = payload.participants
    for participant_name in default_between:
        session.add(BillDefaultSplitParticipantTable(bill_id=bill.id, membership_id=membership_by_name[participant_name].id))

    for item in payload.items:
        if item.paidBy not in membership_by_name:
            raise HTTPException(status_code=400, detail=f"Unknown payer {item.paidBy}")
        bill_item = BillItemTable(
            bill_id=bill.id,
            name=item.name.strip(),
            price=item.price,
            paid_by_membership_id=membership_by_name[item.paidBy].id,
            split_type=item.splitType.strip(),
        )
        session.add(bill_item)
        session.commit()
        session.refresh(bill_item)
        split_between = item.splitBetween
        if bill_item.split_type == "all" and not split_between:
            split_between = payload.participants
        elif bill_item.split_type == item.paidBy and not split_between:
            split_between = [item.paidBy]
        for participant_name in split_between:
            if participant_name not in membership_by_name:
                raise HTTPException(status_code=400, detail=f"Unknown split participant {participant_name}")
            session.add(BillItemSplitTable(item_id=bill_item.id, membership_id=membership_by_name[participant_name].id))

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
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    kitchen = session.get(KitchenTable, kitchen_id)
    if not kitchen:
        raise HTTPException(status_code=404, detail="Kitchen not found")
    bills = session.exec(select(BillTable).where(BillTable.kitchen_id == kitchen_id)).all()
    return {"trips": [_serialize_bill(session, bill) for bill in bills]}


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
    session.commit()
    session.refresh(bill)
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
    session.commit()
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
