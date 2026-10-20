"""The actual application must expose RAG, not just isolated router fixtures."""

from fastapi.testclient import TestClient


def test_main_app_exposes_thread_documents_and_reports_unavailability(monkeypatch):
    from auth.authentication import get_current_subject
    from main import app
    from storage import rag_db

    monkeypatch.setattr(rag_db, "rag_available", lambda: False)
    monkeypatch.setitem(app.dependency_overrides, get_current_subject, lambda: "tester")
    client = TestClient(app, raise_server_exceptions=True)
    response = client.get("/api/rag/threads/new-chat/documents")
    assert response.status_code == 503
    assert "RAG is unavailable" in response.json()["detail"]


def test_main_app_returns_empty_document_list_for_a_chat_without_files(monkeypatch):
    from auth.authentication import get_current_subject
    from main import app
    from routes.rag_pkg import router_context_documents as documents

    class Connection:
        def close(self):
            pass

    monkeypatch.setattr(documents, "_require_rag", lambda: None)
    monkeypatch.setattr(documents, "_rag_connection", Connection)
    monkeypatch.setattr(documents.store, "list_documents", lambda conn, scope: [])
    monkeypatch.setitem(app.dependency_overrides, get_current_subject, lambda: "tester")
    response = TestClient(app).get("/api/rag/threads/new-chat/documents")
    assert response.status_code == 200
    assert response.json() == {"documents": []}
