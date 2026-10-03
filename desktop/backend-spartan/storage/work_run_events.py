"""Event append shared by workers and chat projections; caller owns transaction."""
import json
import sqlite3


def append_work_event(conn: sqlite3.Connection, run_id: str, kind: str, now: int,
                      data: dict | None = None) -> None:
    conn.execute("UPDATE work_runs SET revision=revision+1,updated_at=? WHERE id=?", (now, run_id))
    conn.execute("INSERT INTO work_run_events SELECT id,revision,?,?,updated_at "
                 "FROM work_runs WHERE id=?",
                 (kind, json.dumps(data or {}, ensure_ascii=False, allow_nan=False), run_id))


def decode_work_run(row: sqlite3.Row) -> dict:
    result = dict(row)
    result["request"] = json.loads(result.pop("request_json"))
    raw = result.pop("result_json")
    result["result"] = json.loads(raw) if raw is not None else None
    result.pop("request_hash")
    return result
