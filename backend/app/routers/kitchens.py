from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.db import get_session
from app.core.dependencies import get_current_user, get_kitchen_membership_or_403, require_membership_role
from app.core.security import normalize_email
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
from app.schemas.kitchen import (
    KitchenCreateRequest,
    KitchenDetailResponse,
    KitchenMemberResponse,
    KitchenMembershipAddRequest,
    KitchenSummaryResponse,
    KitchenUpdateRequest,
)

router = APIRouter(prefix="/kitchens", tags=["kitchens"])


def serialize_member(membership: KitchenMembershipTable, user: UserTable) -> KitchenMemberResponse:
    return KitchenMemberResponse(
        membershipId=membership.id,
        userId=user.id,
        email=user.email,
        username=user.username,
        role=membership.role,
    )


@router.get("", response_model=list[KitchenSummaryResponse])
def list_kitchens(
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    memberships = session.exec(
        select(KitchenMembershipTable).where(KitchenMembershipTable.user_id == current_user.id)
    ).all()
    kitchens = []
    for membership in memberships:
        kitchen = session.get(KitchenTable, membership.kitchen_id)
        if not kitchen:
            continue
        member_count = len(
            session.exec(select(KitchenMembershipTable).where(KitchenMembershipTable.kitchen_id == kitchen.id)).all()
        )
        kitchens.append(
            KitchenSummaryResponse(id=kitchen.id, name=kitchen.name, role=membership.role, memberCount=member_count)
        )
    return kitchens


@router.post("", response_model=KitchenDetailResponse)
def create_kitchen(
    data: KitchenCreateRequest,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    kitchen = KitchenTable(name=data.name.strip(), created_by_user_id=current_user.id)
    session.add(kitchen)
    session.commit()
    session.refresh(kitchen)

    membership = KitchenMembershipTable(kitchen_id=kitchen.id, user_id=current_user.id, role="owner")
    session.add(membership)
    session.commit()
    session.refresh(membership)
    return KitchenDetailResponse(id=kitchen.id, name=kitchen.name, role=membership.role, members=[serialize_member(membership, current_user)])


@router.delete("/{kitchen_id}")
def delete_kitchen(
    kitchen_id: int,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    kitchen = session.get(KitchenTable, kitchen_id)
    if not kitchen:
        raise HTTPException(status_code=404, detail="Kitchen not found")

    bills = session.exec(select(BillTable).where(BillTable.kitchen_id == kitchen_id)).all()
    for bill in bills:
        for row in session.exec(
            select(BillDefaultSplitParticipantTable).where(BillDefaultSplitParticipantTable.bill_id == bill.id)
        ).all():
            session.delete(row)
        for row in session.exec(select(BillParticipantTable).where(BillParticipantTable.bill_id == bill.id)).all():
            session.delete(row)
        items = session.exec(select(BillItemTable).where(BillItemTable.bill_id == bill.id)).all()
        for item in items:
            for split in session.exec(select(BillItemSplitTable).where(BillItemSplitTable.item_id == item.id)).all():
                session.delete(split)
            session.delete(item)
        session.delete(bill)

    for kitchen_membership in session.exec(
        select(KitchenMembershipTable).where(KitchenMembershipTable.kitchen_id == kitchen_id)
    ).all():
        session.delete(kitchen_membership)
    session.delete(kitchen)
    session.commit()
    return {"message": "Kitchen deleted successfully", "kitchenId": kitchen_id}


@router.get("/{kitchen_id}", response_model=KitchenDetailResponse)
def get_kitchen(
    kitchen_id: int,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    membership = get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    kitchen = session.get(KitchenTable, kitchen_id)
    if not kitchen:
        raise HTTPException(status_code=404, detail="Kitchen not found")
    members = session.exec(select(KitchenMembershipTable).where(KitchenMembershipTable.kitchen_id == kitchen_id)).all()
    serialized_members = []
    for member in members:
        user = session.get(UserTable, member.user_id)
        if user:
            serialized_members.append(serialize_member(member, user))
    return KitchenDetailResponse(id=kitchen.id, name=kitchen.name, role=membership.role, members=serialized_members)


@router.patch("/{kitchen_id}", response_model=KitchenDetailResponse)
def update_kitchen(
    kitchen_id: int,
    data: KitchenUpdateRequest,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    membership = get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    require_membership_role(membership, {"owner", "admin"})
    kitchen = session.get(KitchenTable, kitchen_id)
    if not kitchen:
        raise HTTPException(status_code=404, detail="Kitchen not found")
    kitchen.name = data.name.strip()
    kitchen.updated_at = utc_now()
    session.add(kitchen)
    session.commit()
    return get_kitchen(kitchen_id, current_user, session)


@router.get("/{kitchen_id}/members", response_model=list[KitchenMemberResponse])
def list_members(
    kitchen_id: int,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    members = session.exec(select(KitchenMembershipTable).where(KitchenMembershipTable.kitchen_id == kitchen_id)).all()
    result = []
    for member in members:
        user = session.get(UserTable, member.user_id)
        if user:
            result.append(serialize_member(member, user))
    return result


@router.post("/{kitchen_id}/members", response_model=KitchenMemberResponse)
def add_member(
    kitchen_id: int,
    data: KitchenMembershipAddRequest,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    membership = get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    require_membership_role(membership, {"owner", "admin"})
    kitchen = session.get(KitchenTable, kitchen_id)
    if not kitchen:
        raise HTTPException(status_code=404, detail="Kitchen not found")

    identifier = data.identifier.strip()
    user = session.exec(
        select(UserTable).where((UserTable.email == normalize_email(identifier)) | (UserTable.username == identifier))
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Ask them to register first.")

    existing_membership = session.exec(
        select(KitchenMembershipTable).where(
            KitchenMembershipTable.kitchen_id == kitchen_id,
            KitchenMembershipTable.user_id == user.id,
        )
    ).first()
    if existing_membership:
        raise HTTPException(status_code=400, detail="User is already a kitchen member")

    role = data.role if data.role in {"owner", "admin", "member"} else "member"
    new_membership = KitchenMembershipTable(kitchen_id=kitchen_id, user_id=user.id, role=role)
    session.add(new_membership)
    session.commit()
    session.refresh(new_membership)
    return serialize_member(new_membership, user)


@router.delete("/{kitchen_id}/members/{membership_id}")
def remove_member(
    kitchen_id: int,
    membership_id: int,
    current_user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    requester_membership = get_kitchen_membership_or_403(session, kitchen_id, current_user.id)
    require_membership_role(requester_membership, {"owner", "admin"})
    membership = session.get(KitchenMembershipTable, membership_id)
    if not membership or membership.kitchen_id != kitchen_id:
        raise HTTPException(status_code=404, detail="Membership not found")

    if membership.role == "owner":
        owner_count = len(
            session.exec(
                select(KitchenMembershipTable).where(
                    KitchenMembershipTable.kitchen_id == kitchen_id,
                    KitchenMembershipTable.role == "owner",
                )
            ).all()
        )
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="Kitchen must retain at least one owner")

    session.delete(membership)
    session.commit()
    return {"message": "Member removed successfully", "membershipId": membership_id}
