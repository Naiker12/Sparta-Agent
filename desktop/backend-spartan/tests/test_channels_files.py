import socket

import pytest
from unittest.mock import AsyncMock

from core.channels import attachments, controls, files


def _dns(ip):
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, 443))]


@pytest.mark.parametrize('url', ['http://example.com/a.pdf', 'https://localhost/a.pdf', 'https://127.0.0.1/a.pdf', 'https://example.com:444/a.pdf'])
def test_download_url_blocks_nonpublic_or_nonhttps(url, monkeypatch):
    monkeypatch.setattr(files.socket, 'getaddrinfo', lambda *args: _dns('8.8.8.8'))
    with pytest.raises(files.FileError, match='file_url_blocked'):
        files._validate_url(url, {})


def test_private_dns_and_file_intent_are_rejected_or_deterministic(monkeypatch):
    monkeypatch.setattr(files.socket, 'getaddrinfo', lambda *args: _dns('169.254.169.254'))
    with pytest.raises(files.FileError, match='file_url_blocked'):
        files._validate_url('https://example.com/a.pdf', {})
    assert files.file_url('/file https://example.com/report.pdf') == 'https://example.com/report.pdf'
    assert files.file_url('descarga este archivo https://example.com/report.pdf') == 'https://example.com/report.pdf'
    assert files.file_url('descarga un archivo') is None


def test_document_upload_occurs_only_after_sender_bound_confirmation(tmp_path, monkeypatch):
    from core.channels import delivery
    from storage.channels import projects
    monkeypatch.setattr(attachments, 'studio_root', lambda: tmp_path)
    monkeypatch.setattr(projects, 'selected', lambda *_: None)
    monkeypatch.setattr(delivery, 'check_access', lambda *_: None)
    monkeypatch.setattr(files.repo, 'event', lambda *_: None)
    account_id = '12345678-1234-1234-1234-123456789abc'
    owner = {'id': account_id, 'owner_user_id': '123', 'allowed_user_ids': ['123'], 'locale': 'es',
             'file_permissions': {'123': {'web_download': True, 'file_create': True, 'file_send': True}}}
    monkeypatch.setattr(files.repo, 'get_account', lambda *_: owner)
    doc = attachments.stage_document(account_id, '123', 'report.pdf', b'%PDF-1.7')
    transport = AsyncMock()
    transport.send_document = AsyncMock()
    async def run():
        # Before Telegram returns the callback, the runtime has no delivery action.
        assert transport.send_document.await_count == 0
        token = controls.issue(account_id, '123', 123, action='send_file', ref=doc.outbox_id)
        update = {'callback_query': {'id': 'q', 'data': token, 'from': {'id': 123},
                  'message': {'chat': {'id': 123, 'type': 'private'}}}}
        approved = controls.consume({**owner, 'enabled': True}, update)
        assert approved['action'] == 'send_file'
        result = await files.confirm_delivery(transport, owner, approved)
        assert result == 'Archivo enviado: report.pdf'
    import asyncio
    asyncio.run(run())
    transport.send_document.assert_awaited_once_with(123, 'report.pdf', 'application/pdf', b'%PDF-1.7')
    with pytest.raises(attachments.AttachmentError):
        attachments.read_staged(account_id, '123', doc.outbox_id)
