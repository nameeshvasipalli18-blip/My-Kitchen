from __future__ import annotations

from collections.abc import Callable

from sqlalchemy import text
from sqlmodel import SQLModel

from app.core.db import engine

Migration = tuple[str, Callable[[], None]]


def _ensure_migration_table() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )


def _initial_schema() -> None:
    SQLModel.metadata.create_all(engine)


MIGRATIONS: list[Migration] = [
    ("0001_initial_app_schema", _initial_schema),
]


def run_migrations() -> None:
    _ensure_migration_table()
    with engine.begin() as connection:
        applied_versions = {
            row[0]
            for row in connection.execute(text("SELECT version FROM schema_migrations"))
        }

    for version, migration in MIGRATIONS:
        if version in applied_versions:
            continue
        migration()
        with engine.begin() as connection:
            connection.execute(
                text("INSERT INTO schema_migrations (version) VALUES (:version)"),
                {"version": version},
            )
