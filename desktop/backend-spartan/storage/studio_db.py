"""SQLite storage for training run history, metrics, and chat history.

This module serves as a transparent unified facade re-exporting all modular
domains from `storage.studio.*` for backwards compatibility.
"""

import hashlib
import json
import logging
import os
import platform
import re
import shutil
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

logger = logging.getLogger(__name__)

from utils.paths import (
    ensure_dir,
    project_workspaces_root,
    studio_db_path,
)
from utils.paths.external_media import is_linux_run_media_path, is_local_filesystem_root
from utils.paths.scan_folder_health import is_readable_dir
from utils.paths.sensitive import (
    contains_sensitive_path_component as _shared_contains_sensitive_path_component,
)
from utils.training_runs import extract_project_name

from storage.studio import *
