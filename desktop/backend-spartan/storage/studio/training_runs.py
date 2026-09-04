"""Training runs and metrics SQLite storage."""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from utils.training_runs import extract_project_name
from storage.studio.connection import get_connection

logger = logging.getLogger(__name__)


def _extract_project_name_from_config_json(config_json: Optional[str]) -> Optional[str]:
    if not config_json:
        return None
    try:
        return extract_project_name(json.loads(config_json))
    except (json.JSONDecodeError, TypeError):
        return None


def create_run(
    id: str,
    model_name: str,
    dataset_name: str,
    config_json: str,
    started_at: str,
    total_steps: Optional[int],
    *,
    output_dir: Optional[str] = None,
    cancel_requested: bool = False,
    resumed_from_run_id: Optional[str] = None,
) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO training_runs (
                id, model_name, dataset_name, config_json, started_at, total_steps,
                output_dir, resume_blocked, resumed_from_run_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                id,
                model_name,
                dataset_name,
                config_json,
                started_at,
                total_steps,
                None if cancel_requested else output_dir,
                int(cancel_requested),
                resumed_from_run_id,
            ),
        )
        if resumed_from_run_id:
            claimed = conn.execute(
                """
                UPDATE training_runs SET resume_blocked = 1
                WHERE id = ? AND status IN ('stopped', 'error')
                  AND output_dir = ? AND resume_blocked = 0
                """,
                (resumed_from_run_id, output_dir),
            )
            if claimed.rowcount != 1:
                raise RuntimeError("Resume source is no longer available")
        conn.commit()
    finally:
        conn.close()


def update_run_total_steps(id: str, total_steps: int) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE training_runs SET total_steps = ? WHERE id = ?",
            (total_steps, id),
        )
        conn.commit()
    finally:
        conn.close()


def update_run_progress(
    id: str, step: int, loss: Optional[float], duration_seconds: Optional[float]
) -> None:
    """Update current progress on a running training run (called on each metric flush)."""
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE training_runs SET final_step = ?, final_loss = ?, duration_seconds = ? WHERE id = ?",
            (step, loss, duration_seconds, id),
        )
        conn.commit()
    finally:
        conn.close()


def finish_run(
    id: str,
    status: str,
    ended_at: str,
    final_step: Optional[int],
    final_loss: Optional[float],
    duration_seconds: Optional[float],
    loss_sparkline: Optional[str] = None,
    output_dir: Optional[str] = None,
    error_message: Optional[str] = None,
    clear_output_dir: bool = False,
    resume_blocked: bool = False,
    config_json: Optional[str] = None,
) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE training_runs
            SET status = ?, ended_at = ?, final_step = ?, final_loss = ?,
                duration_seconds = ?, loss_sparkline = ?,
                config_json = COALESCE(?, config_json),
                output_dir = CASE
                    WHEN resume_blocked = 1 OR ? = 1 THEN NULL
                    WHEN ? IS NOT NULL THEN ?
                    WHEN ? IN ('error', 'stopped') THEN output_dir
                    ELSE NULL
                END,
                error_message = ?,
                resume_blocked = CASE WHEN resume_blocked = 1 OR ? = 1 THEN 1 ELSE ? END
            WHERE id = ? AND status = 'running'
            """,
            (
                status,
                ended_at,
                final_step,
                final_loss,
                duration_seconds,
                loss_sparkline,
                config_json,
                int(clear_output_dir),
                output_dir,
                output_dir,
                status,
                error_message,
                int(clear_output_dir),
                int(resume_blocked),
                id,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def insert_metrics_batch(run_id: str, metrics: list[dict]) -> None:
    if not metrics:
        return
    conn = get_connection()
    try:
        conn.executemany(
            """
            INSERT INTO training_metrics
                (run_id, step, loss, learning_rate, grad_norm, eval_loss, epoch, num_tokens, elapsed_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(run_id, step) DO UPDATE SET
                loss = COALESCE(excluded.loss, loss),
                learning_rate = COALESCE(excluded.learning_rate, learning_rate),
                grad_norm = COALESCE(excluded.grad_norm, grad_norm),
                eval_loss = COALESCE(excluded.eval_loss, eval_loss),
                epoch = COALESCE(excluded.epoch, epoch),
                num_tokens = COALESCE(excluded.num_tokens, num_tokens),
                elapsed_seconds = COALESCE(excluded.elapsed_seconds, elapsed_seconds)
            """,
            [
                (
                    run_id,
                    m.get("step"),
                    m.get("loss"),
                    m.get("learning_rate"),
                    m.get("grad_norm"),
                    m.get("eval_loss"),
                    m.get("epoch"),
                    m.get("num_tokens"),
                    m.get("elapsed_seconds"),
                )
                for m in metrics
            ],
        )
        conn.commit()
    finally:
        conn.close()


def update_run_display_name(id: str, display_name: Optional[str]) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE training_runs SET display_name = ? WHERE id = ?",
            (display_name, id),
        )
        conn.commit()
    finally:
        conn.close()


def update_run_output_dir(id: str, output_dir: Optional[str]) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE training_runs SET output_dir = ?
            WHERE id = ? AND status = 'running' AND resume_blocked = 0
            """,
            (output_dir, id),
        )
        conn.commit()
    finally:
        conn.close()


def update_run_config_json(id: str, config_json: str) -> bool:
    conn = get_connection()
    try:
        cursor = conn.execute(
            """
            UPDATE training_runs SET config_json = ?
            WHERE id = ? AND status = 'running'
            """,
            (config_json, id),
        )
        conn.commit()
        return cursor.rowcount == 1
    finally:
        conn.close()


def mark_run_cancel_requested(id: str) -> bool:
    """Clear resume/export state only while the exact run is still active."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            """
            UPDATE training_runs SET output_dir = NULL, resume_blocked = 1
            WHERE id = ? AND status = 'running'
            """,
            (id,),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def list_runs(limit: int = 50, offset: int = 0) -> dict:
    conn = get_connection()
    try:
        total = conn.execute("SELECT COUNT(*) FROM training_runs").fetchone()[0]
        rows = conn.execute(
            """
            SELECT r.id, r.status, r.model_name, r.dataset_name, r.started_at,
                   r.ended_at, r.total_steps, r.final_step, r.final_loss,
                   r.output_dir, r.duration_seconds, r.error_message,
                   r.loss_sparkline, r.display_name, r.config_json, r.resume_blocked,
                   CASE
                       WHEN r.status IN ('stopped', 'error')
                            AND r.output_dir IS NOT NULL
                            AND EXISTS (
                                SELECT 1
                                FROM training_runs newer
                                WHERE newer.output_dir = r.output_dir
                                  AND newer.status IN ('stopped', 'completed', 'error', 'running')
                                  AND newer.started_at > r.started_at
                            )
                       THEN 1 ELSE 0
                   END AS resumed_later
            FROM training_runs r
            ORDER BY started_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        runs = []
        for row in rows:
            run = dict(row)
            run["project_name"] = _extract_project_name_from_config_json(run.get("config_json"))
            sparkline = run.get("loss_sparkline")
            if sparkline:
                try:
                    run["loss_sparkline"] = json.loads(sparkline)
                except (json.JSONDecodeError, TypeError):
                    logger.debug("Failed to parse loss_sparkline for run %s", run.get("id"))
                    run["loss_sparkline"] = None
            runs.append(run)
        return {"runs": runs, "total": total}
    finally:
        conn.close()


def get_run(id: str) -> Optional[dict]:
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT r.*,
                   CASE
                       WHEN r.status IN ('stopped', 'error')
                            AND r.output_dir IS NOT NULL
                            AND EXISTS (
                                SELECT 1
                                FROM training_runs newer
                                WHERE newer.output_dir = r.output_dir
                                  AND newer.status IN ('stopped', 'completed', 'error', 'running')
                                  AND newer.started_at > r.started_at
                            )
                       THEN 1 ELSE 0
                   END AS resumed_later
            FROM training_runs r
            WHERE r.id = ?
            """,
            (id,),
        ).fetchone()
        if row is None:
            return None
        run = dict(row)
        run["project_name"] = _extract_project_name_from_config_json(run.get("config_json"))
        sparkline = run.get("loss_sparkline")
        if sparkline:
            try:
                run["loss_sparkline"] = json.loads(sparkline)
            except (json.JSONDecodeError, TypeError):
                logger.debug("Failed to parse loss_sparkline for run %s", id)
                run["loss_sparkline"] = None
        return run
    finally:
        conn.close()


def get_resumable_run_by_output_dir(output_dir: str) -> Optional[dict]:
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT r.*,
                   0 AS resumed_later
            FROM training_runs r
            WHERE r.output_dir = ?
              AND r.status IN ('stopped', 'error')
              AND NOT EXISTS (
                  SELECT 1
                  FROM training_runs newer
                  WHERE newer.output_dir = r.output_dir
                    AND newer.status IN ('stopped', 'completed', 'error', 'running')
                    AND newer.started_at > r.started_at
              )
            ORDER BY r.started_at DESC
            LIMIT 1
            """,
            (output_dir,),
        ).fetchone()
        if row is None:
            return None
        run = dict(row)
        sparkline = run.get("loss_sparkline")
        if sparkline:
            try:
                run["loss_sparkline"] = json.loads(sparkline)
            except (json.JSONDecodeError, TypeError):
                logger.debug("Failed to parse loss_sparkline for output_dir %s", output_dir)
                run["loss_sparkline"] = None
        return run
    finally:
        conn.close()


def get_run_metrics(id: str) -> dict:
    """Return metric arrays for a run, using paired step arrays per metric."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT step, loss, learning_rate, grad_norm, eval_loss, epoch,
                   num_tokens, elapsed_seconds
            FROM training_metrics
            WHERE run_id = ?
            ORDER BY step
            """,
            (id,),
        ).fetchall()

        step_history: list[int] = []
        loss_history: list[float] = []
        loss_step_history: list[int] = []
        lr_history: list[float] = []
        lr_step_history: list[int] = []
        grad_norm_history: list[float] = []
        grad_norm_step_history: list[int] = []
        eval_loss_history: list[float] = []
        eval_step_history: list[int] = []
        final_epoch: float | None = None
        final_num_tokens: int | None = None

        for row in rows:
            step = row["step"]
            step_history.append(step)
            if step > 0 and row["loss"] is not None:
                loss_history.append(row["loss"])
                loss_step_history.append(step)
            if step > 0 and row["learning_rate"] is not None:
                lr_history.append(row["learning_rate"])
                lr_step_history.append(step)
            if step > 0 and row["grad_norm"] is not None:
                grad_norm_history.append(row["grad_norm"])
                grad_norm_step_history.append(step)
            if step > 0 and row["eval_loss"] is not None:
                eval_loss_history.append(row["eval_loss"])
                eval_step_history.append(step)
            if row["epoch"] is not None:
                final_epoch = row["epoch"]
            if row["num_tokens"] is not None:
                final_num_tokens = row["num_tokens"]

        return {
            "step_history": step_history,
            "loss_history": loss_history,
            "loss_step_history": loss_step_history,
            "lr_history": lr_history,
            "lr_step_history": lr_step_history,
            "grad_norm_history": grad_norm_history,
            "grad_norm_step_history": grad_norm_step_history,
            "eval_loss_history": eval_loss_history,
            "eval_step_history": eval_step_history,
            "final_epoch": final_epoch,
            "final_num_tokens": final_num_tokens,
        }
    finally:
        conn.close()


def delete_run(id: str) -> None:
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        source = conn.execute(
            "SELECT resumed_from_run_id FROM training_runs WHERE id = ?",
            (id,),
        ).fetchone()
        if source is not None:
            # Keep an explicit resume chain connected when its middle row is removed: the surviving tail
            # still carries the source's cumulative counters, so profile totals must trace it.
            conn.execute(
                """
                UPDATE training_runs
                SET resumed_from_run_id = ?
                WHERE resumed_from_run_id = ?
                """,
                (source["resumed_from_run_id"], id),
            )
        conn.execute("DELETE FROM training_runs WHERE id = ?", (id,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_other_run_output_dirs(exclude_id: str) -> list[str]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT output_dir FROM training_runs WHERE output_dir IS NOT NULL AND id != ?",
            (exclude_id,),
        ).fetchall()
        return [str(row[0]) for row in rows]
    finally:
        conn.close()


def cleanup_orphaned_runs() -> None:
    """Mark any 'running' rows as errored on startup (server restarted mid-training)."""
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE training_runs
            SET status = CASE WHEN resume_blocked = 1 THEN 'stopped' ELSE 'error' END,
                error_message = CASE
                    WHEN resume_blocked = 1 THEN NULL
                    ELSE 'Server restarted during training'
                END,
                output_dir = CASE WHEN resume_blocked = 1 THEN NULL ELSE output_dir END,
                ended_at = ?
            WHERE status = 'running'
            """,
            (datetime.now(timezone.utc).isoformat(),),
        )
        conn.commit()
    finally:
        conn.close()

