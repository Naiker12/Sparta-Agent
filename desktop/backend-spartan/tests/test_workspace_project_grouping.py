import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from storage.studio import chat_threads


class WorkspaceGroupingTests(unittest.TestCase):
    def test_binding_reuses_project_without_inheriting_write(self):
        with tempfile.TemporaryDirectory() as directory:
            db = Path(directory) / 'test.db'
            def connection(*args):
                conn = sqlite3.connect(db)
                conn.row_factory = sqlite3.Row
                return conn
            conn = connection()
            conn.executescript('''
              CREATE TABLE chat_threads(id TEXT PRIMARY KEY,project_id TEXT,updated_at INTEGER);
              INSERT INTO chat_threads VALUES('one',NULL,0),('two',NULL,0);
              CREATE TABLE chat_workspaces(id TEXT PRIMARY KEY,display_name TEXT,canonical_path TEXT,filesystem_identity TEXT,created_at INTEGER,updated_at INTEGER,last_used_at INTEGER);
              CREATE TABLE chat_workspace_bindings(id TEXT PRIMARY KEY,thread_id TEXT UNIQUE,workspace_id TEXT,access TEXT,created_at INTEGER,updated_at INTEGER);
              CREATE TABLE chat_projects(id TEXT PRIMARY KEY,name TEXT,instructions TEXT,connected_folder_path TEXT,workspace_access TEXT,archived INTEGER,created_at INTEGER,updated_at INTEGER);
            ''')
            conn.close()
            def thread(thread_id):
                conn = connection()
                try:
                    return {'projectId': conn.execute('SELECT project_id FROM chat_threads WHERE id=?', (thread_id,)).fetchone()[0]}
                finally: conn.close()
            with patch.object(chat_threads, 'get_connection', connection), patch.object(chat_threads, 'get_chat_thread', thread):
                first = chat_threads.bind_chat_thread_workspace('one','D:/work','work','identity','write',1)
                second = chat_threads.bind_chat_thread_workspace('two','D:/work','work','identity','read',2)
                retry = chat_threads.bind_chat_thread_workspace('one','D:/work','work','identity','write',3)
                self.assertEqual(first['projectId'], second['projectId'])
                self.assertEqual(first['bindingId'], retry['bindingId'])
                self.assertEqual(second['access'], 'read')
            conn = connection()
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM chat_projects').fetchone()[0],1)
            self.assertEqual(conn.execute('SELECT workspace_access FROM chat_projects').fetchone()[0],'read')
            conn.close()


if __name__ == '__main__': unittest.main()
