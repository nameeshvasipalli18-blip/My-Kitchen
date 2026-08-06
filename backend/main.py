from decimal import Decimal, ROUND_HALF_UP
from sqlmodel import Field as SQLField, SQLModel, create_engine, Session
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field as PydanticField
import uvicorn

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex= r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

class Item(BaseModel):
    name: str
    price: float
    paidBy: str
    splitType: str
    splitBetween: list[str]

class Split(BaseModel):
    initialInputs: list[str]
    item: Item | None = None
    items: list[Item] = PydanticField(default_factory=list)

class SplitType(BaseModel):
    type: str
    between: list[str] = PydanticField(default_factory=list)

class Trip(BaseModel):
    id: int
    date: str
    store: str
    participants: list[str]
    defaultPayer: str
    defaultSplit: SplitType | None = None
    items: list[Item] = PydanticField(default_factory=list)

class Participants(BaseModel):
    participants: list[str]

class TripTable(SQLModel, table=True):
    id: int | None = SQLField(default=None, primary_key=True)
    clientTripId: int
    date: str
    store: str
    participants: str  # Store as a comma-separated string
    defaultPayer: str
    defaultSplitType: str | None = None
    defaultSplitBetween: str | None = None  # Store as a comma-separated string

class ItemTable(SQLModel, table=True):
    id: int | None = SQLField(default=None, primary_key=True)
    trip_id: int = SQLField(foreign_key="triptable.id")
    name: str
    price: float
    paidBy: str
    splitType: str
    splitBetween: str | None = None  # Store as a comma-separated string

class ParticipantTable(SQLModel, table=True):
    id: int | None = SQLField(default=None, primary_key=True)
    name: str

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url, echo=True)
SQLModel.metadata.create_all(engine)

def create_participant(data: Participants):
    with Session(engine) as session:
        participant_ids = []
        for name in data.participants:
            participant = ParticipantTable(name=name)
            session.add(participant)
            session.commit()
            session.refresh(participant)
            participant_ids.append(participant.id)
        return participant_ids

def create_trip(trip: Trip):
    with Session(engine) as session:
        trip_table = TripTable(
            clientTripId=trip.id,
            date=trip.date,
            store=trip.store,
            participants=",".join(trip.participants),
            defaultPayer=trip.defaultPayer,
            defaultSplitType=trip.defaultSplit.type if trip.defaultSplit else None,
            defaultSplitBetween=",".join(trip.defaultSplit.between) if trip.defaultSplit and trip.defaultSplit.between else None
        )
        session.add(trip_table)
        session.commit()
        session.refresh(trip_table)

        for item in trip.items:
            item_table = ItemTable(
                trip_id=trip_table.id,
                name=item.name,
                price=item.price,
                paidBy=item.paidBy,
                splitType=item.splitType,
                splitBetween=",".join(item.splitBetween) if item.splitBetween else None
            )
            session.add(item_table)
        session.commit()
        return trip_table.id


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


def get_split_people(participants: list[str], item: Item) -> list[str]:
    split_type = item.splitType.strip().lower()
    if split_type == "all":
        return participants
    if split_type == "custom":
        return item.splitBetween
    if item.splitType == item.paidBy:
        return [item.paidBy]
    raise HTTPException(status_code=400, detail="Invalid split type.")


def calculate_item_split(participants: list[str], item: Item) -> dict:
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
        raise HTTPException(
            status_code=400,
            detail=f"Unknown split participant: {', '.join(invalid_people)}.",
        )

    shares = {person: 0 for person in participants}
    shares.update(split_amount(total_cents, split_people))

    balances = {person: -share for person, share in shares.items()}
    balances[item.paidBy] += total_cents

    debtors = sorted(
        ((person, -amount) for person, amount in balances.items() if amount < 0),
        key=lambda entry: entry[1],
        reverse=True,
    )
    creditors = sorted(
        ((person, amount) for person, amount in balances.items() if amount > 0),
        key=lambda entry: entry[1],
        reverse=True,
    )

    settlements = []
    debtor_index = 0
    creditor_index = 0
    while debtor_index < len(debtors) and creditor_index < len(creditors):
        debtor, owes = debtors[debtor_index]
        creditor, is_owed = creditors[creditor_index]
        amount = min(owes, is_owed)

        settlements.append({
            "from": debtor,
            "to": creditor,
            "amount": format_money(amount),
        })

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
    debtors = sorted(
        ((person, -amount) for person, amount in balances.items() if amount < 0),
        key=lambda entry: entry[1],
        reverse=True,
    )
    creditors = sorted(
        ((person, amount) for person, amount in balances.items() if amount > 0),
        key=lambda entry: entry[1],
        reverse=True,
    )

    settlements = []
    debtor_index = 0
    creditor_index = 0
    while debtor_index < len(debtors) and creditor_index < len(creditors):
        debtor, owes = debtors[debtor_index]
        creditor, is_owed = creditors[creditor_index]
        amount = min(owes, is_owed)

        settlements.append({
            "from": debtor,
            "to": creditor,
            "amount": format_money(amount),
        })

        debtors[debtor_index] = (debtor, owes - amount)
        creditors[creditor_index] = (creditor, is_owed - amount)

        if debtors[debtor_index][1] == 0:
            debtor_index += 1
        if creditors[creditor_index][1] == 0:
            creditor_index += 1

    return settlements


def calculate_split(initials: list[str], items: list[Item]) -> dict:
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
@app.post("/participantable")
async def add_participants(data: Participants):
    participant_ids = create_participant(data)
    with Session(engine) as session:
        participants = session.query(ParticipantTable).filter(ParticipantTable.id.in_(participant_ids)).all()
        return {"participants": [p.name for p in participants]}

@app.get("/participants")
async def get_participants():
    with Session(engine) as session:
        participants = session.query(ParticipantTable).all()
        return {"participants": [p.name for p in participants] if participants else []}



@app.post("/manualsplit")
async def split(data: Split):
    items = data.items or ([data.item] if data.item else [])
    result = calculate_split(data.initialInputs, items)
    return {"message": "Split processed successfully", "result": result}


@app.post("/trip")
async def process_trip(trip: Trip):
    persisted_trip_id = create_trip(trip)
    return JSONResponse(content={"message": "Trip processed successfully", "tripId": persisted_trip_id, "trip": trip.model_dump()})

@app.get("/trips")
async def get_trips():
    with Session(engine) as session:
        trips = session.query(TripTable).all()
        trip_list = []
        for trip in trips:
            items = session.query(ItemTable).filter(ItemTable.trip_id == trip.id).all()
            trip_data = {
                "dbTripId": trip.id,
                "id": trip.clientTripId,
                "date": trip.date,
                "store": trip.store,
                "participants": trip.participants.split(","),
                "defaultPayer": trip.defaultPayer,
                "defaultSplit": {
                    "type": trip.defaultSplitType,
                    "between": trip.defaultSplitBetween.split(",") if trip.defaultSplitBetween else []
                } if trip.defaultSplitType else None,
                "items": [
                    {
                        "name": item.name,
                        "price": item.price,
                        "paidBy": item.paidBy,
                        "splitType": item.splitType,
                        "splitBetween": item.splitBetween.split(",") if item.splitBetween else []
                    }
                    for item in items
                ]
            }
            trip_list.append(trip_data)
        return {"trips": trip_list}
    
@app.delete("/trip/{trip_id}")
async def delete_trip(trip_id: int):
    with Session(engine) as session:
        trip = session.query(TripTable).filter(TripTable.id == trip_id).first()
        if not trip:
            trip = session.query(TripTable).filter(TripTable.clientTripId == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        # Delete associated items first
        session.query(ItemTable).filter(ItemTable.trip_id == trip.id).delete()
        
        # Then delete the trip
        session.delete(trip)
        session.commit()
        
        return {"message": "Trip deleted successfully", "tripId": trip_id}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
