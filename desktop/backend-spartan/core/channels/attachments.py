"""Short-lived staged files for explicitly confirmed Telegram delivery."""
import json
import os
import re
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from utils.paths import ensure_dir, studio_root

MAX_FILE_BYTES = 25 * 1024 * 1024
OUTBOX_TTL_SECONDS = 24 * 60 * 60
MAX_PENDING_PER_USER = 5
_ACCOUNT_ID = re.compile(r"[a-f0-9-]{36}")
_USER_ID = re.compile(r"[0-9]{1,20}")
_OUTBOX_ID = re.compile(r"[a-f0-9]{32}")
_MIME = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
}


@dataclass(frozen=True)
class OutboundDocument:
    outbox_id: str
    filename: str
    size: int
    mime: str


class AttachmentError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _safe_scope(account_id, user_id):
    if not isinstance(account_id, str) or not _ACCOUNT_ID.fullmatch(account_id):
        raise AttachmentError("file_unavailable")
    if not isinstance(user_id, str) or not _USER_ID.fullmatch(user_id):
        raise AttachmentError("file_unavailable")
    return account_id, user_id


def _safe_name(name):
    if not isinstance(name, str):
        name = "download"
    name = Path(name.replace("\\", "/")).name
    name = "".join(char for char in name if ord(char) >= 32 and ord(char) != 127)
    name = re.sub(r"[^\w .()-]+", "_", name, flags=re.UNICODE).strip(" .")
    if name in ("", ".", ".."):
        name = "download"
    suffix = Path(name).suffix.lower()
    if suffix not in _MIME:
        raise AttachmentError("file_type_blocked")
    stem = Path(name).stem[:96].strip(" .") or "download"
    return f"{stem}{suffix}", suffix


def _matches_signature(raw, suffix):
    if suffix == ".pdf":
        return raw.startswith(b"%PDF-")
    if suffix == ".png":
        return raw.startswith(b"\x89PNG\r\n\x1a\n")
    if suffix == ".jpg":
        return raw.startswith(b"\xff\xd8\xff")
    if suffix == ".webp":
        return len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"
    if suffix in (".docx", ".xlsx", ".pptx"):
        return raw.startswith(b"PK\x03\x04")
    if suffix in (".txt", ".md", ".csv", ".json"):
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            return False
        if any(ord(char) < 32 and char not in "\n\r\t" for char in text):
            return False
        if suffix == ".json":
            import json as json_module
            try:
                json_module.loads(text)
            except (ValueError, TypeError):
                return False
        return True
    return False


def _root(account_id, user_id):
    account_id, user_id = _safe_scope(account_id, user_id)
    base = studio_root() / "channels" / "outbox"
    # Do not follow an attacker planted symlink in any parent of the outbox.
    root = base / account_id / user_id
    for path in (base, base / account_id, root):
        if path.is_symlink():
            raise AttachmentError("file_unavailable")
    return root


def _metadata_path(root, outbox_id):
    if not isinstance(outbox_id, str) or not _OUTBOX_ID.fullmatch(outbox_id):
        raise AttachmentError("file_unavailable")
    return root / f"{outbox_id}.json"


def _expire(root, now=None):
    cutoff = (time.time() if now is None else now) - OUTBOX_TTL_SECONDS
    if not root.exists():
        return
    for metadata in root.glob("*.json"):
        try:
            record = json.loads(metadata.read_text(encoding="utf-8"))
            created_at = record.get("created_at")
            if type(created_at) is not int or created_at < cutoff:
                data_path = root / record.get("data_file", "")
                if data_path.parent == root and data_path.name != "":
                    data_path.unlink(missing_ok=True)
                metadata.unlink(missing_ok=True)
        except (OSError, ValueError, TypeError):
            metadata.unlink(missing_ok=True)


def stage_document(account_id, user_id, filename, raw, *, now=None):
    root = _root(account_id, user_id)
    ensure_dir(root)
    _expire(root, now)
    if len(list(root.glob("*.json"))) >= MAX_PENDING_PER_USER:
        raise AttachmentError("too_many_pending_files")
    if not isinstance(raw, bytes) or not raw or len(raw) > MAX_FILE_BYTES:
        raise AttachmentError("file_too_large")
    safe_name, suffix = _safe_name(filename)
    if not _matches_signature(raw, suffix):
        raise AttachmentError("file_type_blocked")
    identifier = uuid.uuid4().hex
    data_name = f"{identifier}{suffix}"
    data_path = root / data_name
    metadata_path = _metadata_path(root, identifier)
    now = int(time.time() if now is None else now)
    record = {"outbox_id": identifier, "filename": safe_name, "size": len(raw),
              "mime": _MIME[suffix], "data_file": data_name, "created_at": now}
    try:
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        descriptor = os.open(data_path, flags, 0o600)
        with os.fdopen(descriptor, "wb") as output:
            output.write(raw)
        metadata_flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, "O_NOFOLLOW"):
            metadata_flags |= os.O_NOFOLLOW
        descriptor = os.open(metadata_path, metadata_flags, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump(record, output)
    except OSError:
        data_path.unlink(missing_ok=True)
        metadata_path.unlink(missing_ok=True)
        raise AttachmentError("file_unavailable") from None
    return OutboundDocument(identifier, safe_name, len(raw), _MIME[suffix])


def read_staged(account_id, user_id, outbox_id, *, now=None):
    root = _root(account_id, user_id)
    metadata_path = _metadata_path(root, outbox_id)
    try:
        if metadata_path.is_symlink():
            raise AttachmentError("file_unavailable")
        record = json.loads(metadata_path.read_text(encoding="utf-8"))
        if record.get("outbox_id") != outbox_id or type(record.get("created_at")) is not int:
            raise AttachmentError("file_unavailable")
        if (time.time() if now is None else now) - record["created_at"] > OUTBOX_TTL_SECONDS:
            delete_staged(account_id, user_id, outbox_id)
            raise AttachmentError("file_expired")
        filename, suffix = _safe_name(record.get("filename"))
        expected_data_name = f"{outbox_id}{suffix}"
        if record.get("data_file") != expected_data_name:
            raise AttachmentError("file_unavailable")
        data_path = root / expected_data_name
        if data_path.is_symlink():
            raise AttachmentError("file_unavailable")
        data = data_path.read_bytes()
        if (not data or len(data) != record.get("size") or len(data) > MAX_FILE_BYTES
                or not _matches_signature(data, suffix)):
            raise AttachmentError("file_unavailable")
        return OutboundDocument(outbox_id, filename, len(data), _MIME[suffix]), data
    except AttachmentError:
        raise
    except (OSError, ValueError, TypeError):
        raise AttachmentError("file_unavailable") from None


def delete_staged(account_id, user_id, outbox_id):
    root = _root(account_id, user_id)
    metadata_path = _metadata_path(root, outbox_id)
    try:
        record = json.loads(metadata_path.read_text(encoding="utf-8"))
        filename, suffix = _safe_name(record.get("filename"))
        expected_data_name = f"{outbox_id}{suffix}"
        if record.get("data_file") == expected_data_name:
            (root / expected_data_name).unlink(missing_ok=True)
        metadata_path.unlink(missing_ok=True)
    except (OSError, ValueError, TypeError, AttachmentError):
        metadata_path.unlink(missing_ok=True)

