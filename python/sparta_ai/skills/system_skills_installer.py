"""Auto-installs bundled system skills into ~/.sparta/skills/.system at startup.

Idempotent via SHA-256 fingerprint — inspired by codex-rs/skills/src/lib.rs.
On each startup the bundled skills directory is fingerprinted; if it matches
the marker file in the destination, no I/O is performed (fast path).
If the fingerprint differs (new Sparta release, updated skills), the old
directory is replaced atomically.
"""
import hashlib
import logging
import shutil
from pathlib import Path

logger = logging.getLogger("sparta_ai.skills.installer")

MARKER_NAME = ".sparta-system-skills.marker"


def _fingerprint(src_dir: Path) -> str:
    """Compute a deterministic SHA-256 fingerprint of all files in src_dir."""
    h = hashlib.sha256()
    for path in sorted(src_dir.rglob("*")):
        if path.is_file():
            h.update(str(path.relative_to(src_dir)).encode("utf-8"))
            h.update(path.read_bytes())
    return h.hexdigest()


def install_system_skills(bundled_skills_dir: Path, user_home: Path | None = None) -> bool:
    """Synchronise bundled skills → ~/.sparta/skills/.system.

    Args:
        bundled_skills_dir: Path to the repo's ``skills/`` directory
            (containing category subdirs with SKILL.md files).
        user_home: Override for the user's home directory (defaults to
            ``Path.home()``).

    Returns:
        ``True`` if skills were reinstalled, ``False`` if already up to date.
    """
    if user_home is None:
        user_home = Path.home()

    if not bundled_skills_dir.is_dir():
        logger.warning(
            "Bundled skills directory not found: %s — skipping system skill install",
            bundled_skills_dir,
        )
        return False

    dest = user_home / ".sparta" / "skills" / ".system"
    dest.parent.mkdir(parents=True, exist_ok=True)

    expected = _fingerprint(bundled_skills_dir)
    marker = dest / MARKER_NAME

    if dest.is_dir() and marker.exists() and marker.read_text().strip() == expected:
        logger.debug("System skills fingerprint matches — no reinstall needed")
        return False

    logger.info(
        "System skills fingerprint changed — reinstalling to %s",
        dest,
    )

    if dest.exists():
        shutil.rmtree(dest)

    shutil.copytree(bundled_skills_dir, dest)
    marker.write_text(expected)

    logger.info("System skills installed successfully (%s skills synced)", expected[:12])
    return True
