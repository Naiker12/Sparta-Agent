"""Domain exceptions for SQLite studio storage."""


class ProjectWorkspaceError(OSError):
    """Raised when a project's workspace folder cannot be created.

    Tagged, and carrying the folder, so a caller can name it. The same upsert
    also touches the database directory, and that is a different path with a
    different fix.
    """

    def __init__(self, path: str, cause: OSError):
        super().__init__(str(cause))
        self.path = path


class ChatThreadDeletedError(RuntimeError):
    """Raised when a stale writer tries to recreate a deleted thread id."""


class ChatThreadPreconditionFailed(Exception):
    """The thread changed between the caller reading it and writing it."""


class ChatMessageConflictError(RuntimeError):
    """Raised when a chat message id already belongs to another thread."""


class ChatMessageProtectedError(RuntimeError):
    """Raised when pruning would remove a message owned by a durable feature."""


class CorruptSettingsError(RuntimeError):
    """Raised when a partial settings patch would overwrite corrupt settings."""
