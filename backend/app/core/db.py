from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")
DATABASE_PATH = BASE_DIR / "database.db"
DATABASE_URL = os.getenv("MY_KITCHEN_DATABASE_URL", f"sqlite:///{DATABASE_PATH}")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if is_sqlite else {},
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    if not is_sqlite:
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def get_session():
    with Session(engine) as session:
        yield session
