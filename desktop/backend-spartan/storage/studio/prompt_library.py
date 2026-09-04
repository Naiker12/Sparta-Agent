"""Prompt library storage (entries and lists) for studio.db."""

import json
import sqlite3
from storage.studio.connection import get_connection

def _prompt_entry_from_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "text": row["text"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def list_prompt_entries() -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM prompt_entries ORDER BY created_at DESC").fetchall()
        return [_prompt_entry_from_row(r) for r in rows]
    finally:
        conn.close()


def upsert_prompt_entry(entry: dict) -> dict:
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO prompt_entries (id, name, text, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                text = excluded.text,
                updated_at = excluded.updated_at
            """,
            (
                entry["id"],
                entry["name"],
                entry["text"],
                entry["createdAt"],
                entry["updatedAt"],
            ),
        )
        conn.commit()
        return entry
    finally:
        conn.close()


def delete_prompt_entry(entry_id: str) -> None:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM prompt_entries WHERE id = ?", (entry_id,))
        conn.commit()
    finally:
        conn.close()


def bulk_upsert_prompt_entries(entries: list[dict]) -> int:
    if not entries:
        return 0
    conn = get_connection()
    try:
        conn.executemany(
            """
            INSERT INTO prompt_entries (id, name, text, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                text = excluded.text,
                updated_at = excluded.updated_at
            """,
            [(e["id"], e["name"], e["text"], e["createdAt"], e["updatedAt"]) for e in entries],
        )
        conn.commit()
        return len(entries)
    finally:
        conn.close()


def _prompt_list_from_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "items": json.loads(row["items_json"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def list_prompt_lists_db() -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM prompt_lists ORDER BY created_at DESC").fetchall()
        return [_prompt_list_from_row(r) for r in rows]
    finally:
        conn.close()


def upsert_prompt_list(lst: dict) -> dict:
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO prompt_lists (id, name, items_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                items_json = excluded.items_json,
                updated_at = excluded.updated_at
            """,
            (
                lst["id"],
                lst["name"],
                json.dumps(lst["items"]),
                lst["createdAt"],
                lst["updatedAt"],
            ),
        )
        conn.commit()
        return lst
    finally:
        conn.close()


def delete_prompt_list_db(list_id: str) -> None:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM prompt_lists WHERE id = ?", (list_id,))
        conn.commit()
    finally:
        conn.close()


def bulk_upsert_prompt_lists(lists: list[dict]) -> int:
    if not lists:
        return 0
    conn = get_connection()
    try:
        conn.executemany(
            """
            INSERT INTO prompt_lists (id, name, items_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                items_json = excluded.items_json,
                updated_at = excluded.updated_at
            """,
            [
                (
                    lst["id"],
                    lst["name"],
                    json.dumps(lst["items"]),
                    lst["createdAt"],
                    lst["updatedAt"],
                )
                for lst in lists
            ],
        )
        conn.commit()
        return len(lists)
    finally:
        conn.close()



