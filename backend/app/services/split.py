from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException

from app.schemas.bill import ItemPayload


def to_cents(amount: float) -> int:
    decimal_amount = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return int(decimal_amount * 100)


def format_money(cents: int) -> float:
    return round(cents / 100, 2)


def split_amount(total_cents: int, people: list[str]) -> dict[str, int]:
    base_share, remainder = divmod(total_cents, len(people))
    return {
        person: base_share + (1 if index < remainder else 0)
        for index, person in enumerate(people)
    }


def validate_participants(initials: list[str]) -> list[str]:
    participants = [name.strip() for name in initials if name.strip()]
    if not participants:
        raise HTTPException(status_code=400, detail="Add at least one person.")
    if len(participants) != len(set(participants)):
        raise HTTPException(status_code=400, detail="Person names must be unique.")
    return participants


def get_split_people(participants: list[str], item: ItemPayload) -> list[str]:
    split_type = item.splitType.strip().lower()
    if split_type == "all":
        return item.splitBetween or participants
    if split_type == "custom":
        return item.splitBetween
    if item.splitType == item.paidBy:
        return [item.paidBy]
    raise HTTPException(status_code=400, detail="Invalid split type.")


def calculate_item_split(participants: list[str], item: ItemPayload) -> dict:
    if item.paidBy not in participants:
        raise HTTPException(status_code=400, detail="Paid by must be one of the people.")

    total_cents = to_cents(item.price)
    if total_cents <= 0:
        raise HTTPException(status_code=400, detail="Price must be greater than zero.")

    split_people = get_split_people(participants, item)
    if not split_people:
        raise HTTPException(status_code=400, detail="Choose at least one person to split with.")

    invalid_people = [person for person in split_people if person not in participants]
    if invalid_people:
        raise HTTPException(status_code=400, detail=f"Unknown split participant: {', '.join(invalid_people)}.")

    shares = {person: 0 for person in participants}
    shares.update(split_amount(total_cents, split_people))

    balances = {person: -share for person, share in shares.items()}
    balances[item.paidBy] += total_cents

    debtors = sorted(((person, -amount) for person, amount in balances.items() if amount < 0), key=lambda entry: entry[1], reverse=True)
    creditors = sorted(((person, amount) for person, amount in balances.items() if amount > 0), key=lambda entry: entry[1], reverse=True)

    settlements = []
    debtor_index = 0
    creditor_index = 0
    while debtor_index < len(debtors) and creditor_index < len(creditors):
        debtor, owes = debtors[debtor_index]
        creditor, is_owed = creditors[creditor_index]
        amount = min(owes, is_owed)
        settlements.append({"from": debtor, "to": creditor, "amount": format_money(amount)})
        debtors[debtor_index] = (debtor, owes - amount)
        creditors[creditor_index] = (creditor, is_owed - amount)
        if debtors[debtor_index][1] == 0:
            debtor_index += 1
        if creditors[creditor_index][1] == 0:
            creditor_index += 1

    return {
        "itemName": item.name,
        "total": format_money(total_cents),
        "totalInCents": total_cents,
        "paidBy": item.paidBy,
        "splitBetween": split_people,
        "shares": {person: format_money(amount) for person, amount in shares.items()},
        "balances": {person: format_money(amount) for person, amount in balances.items()},
        "balancesInCents": balances,
        "settlements": settlements,
    }


def settle_balances(balances: dict[str, int]) -> list[dict]:
    debtors = sorted(((person, -amount) for person, amount in balances.items() if amount < 0), key=lambda entry: entry[1], reverse=True)
    creditors = sorted(((person, amount) for person, amount in balances.items() if amount > 0), key=lambda entry: entry[1], reverse=True)
    settlements = []
    debtor_index = 0
    creditor_index = 0
    while debtor_index < len(debtors) and creditor_index < len(creditors):
        debtor, owes = debtors[debtor_index]
        creditor, is_owed = creditors[creditor_index]
        amount = min(owes, is_owed)
        settlements.append({"from": debtor, "to": creditor, "amount": format_money(amount)})
        debtors[debtor_index] = (debtor, owes - amount)
        creditors[creditor_index] = (creditor, is_owed - amount)
        if debtors[debtor_index][1] == 0:
            debtor_index += 1
        if creditors[creditor_index][1] == 0:
            creditor_index += 1
    return settlements


def calculate_split(initials: list[str], items: list[ItemPayload]) -> dict:
    participants = validate_participants(initials)
    if not items:
        raise HTTPException(status_code=400, detail="Add at least one item.")

    item_results = [calculate_item_split(participants, item) for item in items]
    balances = {person: 0 for person in participants}
    total_cents = 0

    for item_result in item_results:
        total_cents += item_result["totalInCents"]
        for person, amount in item_result["balancesInCents"].items():
            balances[person] += amount
        del item_result["totalInCents"]
        del item_result["balancesInCents"]

    return {
        "participants": participants,
        "total": format_money(total_cents),
        "items": item_results,
        "balances": {person: format_money(amount) for person, amount in balances.items()},
        "settlements": settle_balances(balances),
    }
