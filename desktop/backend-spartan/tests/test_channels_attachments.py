import pytest

from core.channels import attachments


def test_outbox_sanitizes_name_validates_signature_and_reads_only_scoped_file(tmp_path, monkeypatch):
    monkeypatch.setattr(attachments, 'studio_root', lambda: tmp_path)
    account_id = '12345678-1234-1234-1234-123456789abc'
    document = attachments.stage_document(account_id, '123', '../../Quarterly report.pdf', b'%PDF-1.7\nbody')
    assert document.filename == 'Quarterly report.pdf'
    loaded, raw = attachments.read_staged(account_id, '123', document.outbox_id)
    assert loaded == document and raw.startswith(b'%PDF-')
    with pytest.raises(attachments.AttachmentError, match='file_type_blocked'):
        attachments.stage_document(account_id, '123', 'evil.exe', b'MZ')
    with pytest.raises(attachments.AttachmentError, match='file_type_blocked'):
        attachments.stage_document(account_id, '123', 'fake.pdf', b'not a pdf')


def test_outbox_expires_and_rejects_other_user(tmp_path, monkeypatch):
    monkeypatch.setattr(attachments, 'studio_root', lambda: tmp_path)
    account_id = '12345678-1234-1234-1234-123456789abc'
    document = attachments.stage_document(account_id, '123', 'report.pdf', b'%PDF-1.7', now=1000)
    with pytest.raises(attachments.AttachmentError):
        attachments.read_staged(account_id, '124', document.outbox_id, now=1001)
    with pytest.raises(attachments.AttachmentError, match='file_expired'):
        attachments.read_staged(account_id, '123', document.outbox_id, now=1000 + attachments.OUTBOX_TTL_SECONDS + 1)
