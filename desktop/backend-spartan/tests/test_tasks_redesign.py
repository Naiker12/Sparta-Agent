import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from storage.studio import memory_tasks


class TaskRedesignTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Path(self.temp.name) / 'tasks.db'
        def connection():
            conn = sqlite3.connect(self.db)
            conn.row_factory = sqlite3.Row
            return conn
        self.connection = connection
        conn = connection()
        conn.executescript('''
        CREATE TABLE agent_tasks (id TEXT PRIMARY KEY, title TEXT, prompt TEXT,
          schedule_type TEXT, interval_seconds INTEGER, run_at INTEGER, channel TEXT,
          thread_id TEXT, owner_subject TEXT, enabled INTEGER, status TEXT DEFAULT 'pending',
          last_run_at INTEGER, next_run_at INTEGER, last_error TEXT, created_at INTEGER, updated_at INTEGER, schedule_config TEXT DEFAULT '{}');
        CREATE TABLE agent_task_runs (id TEXT, task_id TEXT, started_at INTEGER,
          finished_at INTEGER, status TEXT, output TEXT, error TEXT);
        ''')
        conn.close()
        self.mock = patch.object(memory_tasks, 'get_connection', connection)
        self.mock.start()
        self.data = dict(title='Review', prompt='Read only', scheduleType='interval', intervalSeconds=60, enabled=True)

    def tearDown(self):
        self.mock.stop()
        self.temp.cleanup()

    def test_owner_isolation_including_legacy(self):
        owned = memory_tasks.upsert_task(self.data, owner_subject='one')
        legacy = memory_tasks.upsert_task(self.data)
        self.assertEqual(len(memory_tasks.list_tasks('one')), 1)
        self.assertIsNone(memory_tasks.get_task(owned['id'], 'two'))
        self.assertIsNone(memory_tasks.get_task(legacy['id'], 'one'))
        self.assertFalse(memory_tasks.delete_task(legacy['id'], 'one'))
        self.assertEqual(memory_tasks.upsert_task(self.data, owned['id'], 'two'), {})

    def test_edit_preserves_due_date_pause_clears_it(self):
        with patch.object(memory_tasks, '_now', return_value=1000):
            task = memory_tasks.upsert_task(self.data, owner_subject='one')
        with patch.object(memory_tasks, '_now', return_value=9000):
            updated = memory_tasks.upsert_task({**self.data, 'title': 'Changed'}, task['id'], 'one')
            paused = memory_tasks.upsert_task({**self.data, 'enabled': False}, task['id'], 'one')
        self.assertEqual(updated['nextRunAt'], task['nextRunAt'])
        self.assertIsNone(paused['nextRunAt'])

    def test_missing_update_does_not_create_and_once_validates(self):
        self.assertEqual(memory_tasks.upsert_task(self.data, 'missing', 'one'), {})
        with self.assertRaises(ValueError):
            memory_tasks.upsert_task({**self.data, 'scheduleType': 'once', 'runAt': None}, owner_subject='one')
        with patch.object(memory_tasks, '_now', return_value=1000):
            draft = memory_tasks.upsert_task({**self.data, 'scheduleType': 'once', 'runAt': 2000, 'enabled': False}, owner_subject='one')
        self.assertEqual(draft['runAt'], 2000)
        self.assertIsNone(draft['nextRunAt'])

    def test_manual_runs_are_owned_exclusive_and_durable(self):
        task = memory_tasks.upsert_task(self.data, owner_subject='one')
        with self.assertRaises(LookupError):
            memory_tasks.begin_task_preview(task['id'], 'two')
        run_id = memory_tasks.begin_task_preview(task['id'], 'one')
        with self.assertRaises(ValueError):
            memory_tasks.begin_task_preview(task['id'], 'one')
        memory_tasks.finish_task_preview(run_id, output='Result')
        run = memory_tasks.get_task(task['id'], 'one')['runs'][0]
        self.assertEqual(run['status'], 'completed')
        self.assertEqual(run['output'], 'Result')
        self.assertIsNotNone(run['finishedAt'])
        second = memory_tasks.begin_task_preview(task['id'], 'one')
        memory_tasks.finish_task_preview(second, error='Failed')
        self.assertEqual(len(memory_tasks.get_task(task['id'], 'one')['runs']), 2)

    def test_abandoned_run_can_be_retried(self):
        task = memory_tasks.upsert_task(self.data, owner_subject='one')
        with patch.object(memory_tasks, '_now', return_value=1000):
            first = memory_tasks.begin_task_preview(task['id'], 'one')
        with patch.object(memory_tasks, '_now', return_value=122000):
            memory_tasks.begin_task_preview(task['id'], 'one')
        runs = memory_tasks.get_task(task['id'], 'one')['runs']
        self.assertEqual(next(r for r in runs if r['id'] == first)['status'], 'interrupted')

    def test_weekly_configuration_persists_and_validates(self):
        data = {**self.data, 'enabled': False, 'scheduleType': 'weekly', 'weekdays': [0, 2, 4], 'localTime': '14:30', 'timezone': 'America/Bogota', 'notify': False}
        task = memory_tasks.upsert_task(data, owner_subject='one')
        self.assertEqual(task['weekdays'], [0, 2, 4])
        self.assertEqual(task['localTime'], '14:30')
        self.assertFalse(task['notify'])
        for invalid in ({'weekdays': []}, {'weekdays': [7]}, {'localTime': '25:00'}, {'timezone': 'Invalid/Zone'}):
            with self.assertRaises(ValueError): memory_tasks.upsert_task({**data, **invalid}, owner_subject='one')

    def test_scheduler_requires_consent_claims_once_and_pauses(self):
        with patch.object(memory_tasks, '_now', return_value=1000):
            task = memory_tasks.upsert_task(self.data, owner_subject='one')
        with patch.object(memory_tasks, '_now', return_value=62000):
            self.assertIsNone(memory_tasks.claim_due_task())
            activated = memory_tasks.activate_task(task['id'], 'one', 'provider', 'model')
        self.assertEqual(activated['nextRunAt'], 122000)
        with patch.object(memory_tasks, '_now', return_value=123000):
            claimed, run_id = memory_tasks.claim_due_task()
            self.assertEqual(claimed['id'], task['id'])
            self.assertIsNone(memory_tasks.claim_due_task())
            memory_tasks.finish_task_preview(run_id, output='Result')
            events = memory_tasks.task_notifications('one', 0)
            self.assertEqual(len(events), 1)
            self.assertEqual(memory_tasks.task_notifications('two', 0), [])
            memory_tasks.upsert_task({**activated, 'enabled': False}, task['id'], 'one')
        with patch.object(memory_tasks, '_now', return_value=999999):
            self.assertIsNone(memory_tasks.claim_due_task())

    def test_weekly_next_occurrence_uses_timezone(self):
        from core.inference.task_scheduler import next_occurrence
        from datetime import datetime, timezone
        now = int(datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc).timestamp() * 1000)
        task = {'scheduleType': 'weekly', 'timezone': 'America/Bogota', 'localTime': '09:00', 'weekdays': [2]}
        expected = int(datetime(2026, 9, 30, 14, 0, tzinfo=timezone.utc).timestamp() * 1000)
        self.assertEqual(next_occurrence(task, now), expected)


if __name__ == '__main__': unittest.main()
