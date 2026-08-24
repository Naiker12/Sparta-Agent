
import threading
from contextlib import contextmanager
from typing import Iterator


_TRAINING_LIFECYCLE_LOCK = threading.RLock()


@contextmanager
def training_lifecycle_guard() -> Iterator[None]:
    with _TRAINING_LIFECYCLE_LOCK:
        yield
