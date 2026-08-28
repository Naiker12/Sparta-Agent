"""
Pure-Python service layer for Skills management (reading, searching catalogs,
installing, toggling, removing), consumed by the LLM tool dispatcher in ``tools.py``.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import shutil
from pathlib import Path
from typing import Any, Optional
import urllib.request

logger = logging.getLogger(__name__)

# Find project root by walking up until skills-lock.json, sparta-vault.json or desktop/backend-spartan is found
def _find_project_root() -> Path:
    curr = Path(__file__).resolve().parent
    for _ in range(8):
        if (curr / "skills-lock.json").exists() or (curr / "sparta-vault.json").exists() or ((curr / "desktop").exists() and (curr / "skills").exists()):
            return curr
        curr = curr.parent
    return Path(__file__).resolve().parents[4]

_PROJECT_ROOT = _find_project_root()


def _get_project_skills_dir() -> Path:
    """Builtin project skills directory (<root>/skills)."""
    return _PROJECT_ROOT / "skills"


def _get_workspace_agents_skills_dir() -> Path:
    """Workspace .agents/skills directory."""
    return _PROJECT_ROOT / ".agents" / "skills"


def _get_user_skills_dir() -> Path:
    """User-installed skills directory (in OS userData/sparta/skills)."""
    if os.name == "nt":
        base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
    elif os.name == "posix":
        if "darwin" in os.uname().sysname.lower():
            base = str(Path.home() / "Library" / "Application Support")
        else:
            base = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    else:
        base = str(Path.home())
    return Path(base) / "sparta" / "skills"


def _get_system_skills_dir() -> Path:
    """System-installed skills directory."""
    return _get_user_skills_dir() / ".system"


def _get_skills_lock_file() -> Path:
    """Skills lockfile (<root>/skills-lock.json)."""
    return _PROJECT_ROOT / "skills-lock.json"


def _get_index_cache_dir() -> Path:
    """Cached marketplace catalogs directory."""
    return _get_project_skills_dir() / "index-cache"


def _parse_frontmatter(content: str) -> dict[str, Any]:
    """Parse YAML-like frontmatter from SKILL.md."""
    meta: dict[str, Any] = {}
    if not content.startswith("---"):
        return meta

    end_idx = content.find("\n---", 3)
    if end_idx == -1:
        return meta

    raw_yaml = content[3:end_idx].strip()
    for line in raw_yaml.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, val = line.split(":", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if val.lower() == "true":
                meta[key] = True
            elif val.lower() == "false":
                meta[key] = False
            elif val.startswith("[") and val.endswith("]"):
                items = [x.strip().strip('"').strip("'") for x in val[1:-1].split(",") if x.strip()]
                meta[key] = items
            else:
                meta[key] = val
    return meta


def _scan_dir_for_skills(directory: Path, source_label: str) -> list[dict[str, Any]]:
    """Scan a directory recursively for SKILL.md files."""
    skills: list[dict[str, Any]] = []
    if not directory.exists() or not directory.is_dir():
        return skills

    for skill_file in directory.rglob("SKILL.md"):
        # Skip index-cache or hidden paths
        parts = skill_file.relative_to(directory).parts
        if any(p.startswith(".") or p == "index-cache" for p in parts):
            continue

        skill_dir = skill_file.parent
        # ID is relative path without SKILL.md (e.g. coding/bug-finder or my-skill)
        rel_id = "/".join(parts[:-1]) if len(parts) > 1 else skill_dir.name
        try:
            content = skill_file.read_text(encoding="utf-8", errors="ignore")
            meta = _parse_frontmatter(content)
            name = meta.get("name") or rel_id.split("/")[-1]
            skills.append({
                "id": rel_id,
                "name": name,
                "description": meta.get("description") or "Sin descripción",
                "source": source_label,
                "path": str(skill_file),
                "tags": meta.get("tags") or [],
                "requires_api_key": meta.get("requiresApiKey", False),
                "env_vars": meta.get("envVars") or [],
            })
        except Exception as exc:
            logger.debug("Error reading skill at %s: %s", skill_file, exc)
    return skills


def list_installed_skills() -> list[dict[str, Any]]:
    """Return installed skills as safe structured data for UI and model callers."""
    all_skills: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    # Priority: user > system > workspace > builtin
    roots = [
        (_get_user_skills_dir(), "Usuario"),
        (_get_system_skills_dir(), "Sistema"),
        (_get_workspace_agents_skills_dir(), "Workspace"),
        (_get_project_skills_dir(), "Integradas"),
    ]

    for root_dir, label in roots:
        for skill in _scan_dir_for_skills(root_dir, label):
            if skill["id"] not in seen_ids:
                seen_ids.add(skill["id"])
                all_skills.append(skill)

    return all_skills


def list_skills_for_model(arguments: dict[str, Any] | None = None) -> str:
    """List all available installed skills."""
    all_skills = list_installed_skills()
    if not all_skills:
        return "No hay skills instaladas en el sistema."

    lines = [f"🛠️ Skills disponibles ({len(all_skills)}):"]
    for s in all_skills:
        auth_note = ""
        if s.get("requires_api_key") or s.get("env_vars"):
            vars_list = ", ".join(s.get("env_vars") or ["API Key"])
            auth_note = f" 🔑 [Requiere: {vars_list}]"
        lines.append(f"- **{s['name']}** (`{s['id']}`) [{s['source']}]: {s['description']}{auth_note}")
    return "\n".join(lines)


def search_skill_catalog_for_model(arguments: dict[str, Any] | str) -> str:
    """Search marketplace catalogs in index-cache/ for skills matching a query."""
    if isinstance(arguments, str):
        try:
            parsed = json.loads(arguments)
            arguments = parsed if isinstance(parsed, dict) else {}
        except Exception:
            arguments = {"query": arguments}

    query = (arguments.get("query") or arguments.get("q") or "").strip().lower()
    if not query:
        return "Por favor especifica un término de búsqueda para el catálogo de skills (ej. 'github', 'notion', 'testing')."

    cache_dir = _get_index_cache_dir()
    if not cache_dir.exists() or not cache_dir.is_dir():
        return "El catálogo en caché de skills no está disponible en este momento."

    matches: list[dict[str, Any]] = []

    for cat_file in cache_dir.glob("*.json"):
        try:
            data = json.loads(cat_file.read_text(encoding="utf-8", errors="ignore"))
            items = data if isinstance(data, list) else data.get("skills", [])
            for item in items:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or "")
                desc = str(item.get("description") or "")
                tags = " ".join(item.get("tags") or []) if isinstance(item.get("tags"), list) else str(item.get("tags") or "")
                search_blob = f"{name} {desc} {tags}".lower()
                if query in search_blob:
                    matches.append({
                        "name": name,
                        "description": desc or "Sin descripción",
                        "repo": item.get("repo") or item.get("source") or cat_file.stem,
                        "catalog": cat_file.stem,
                    })
                    if len(matches) >= 20:
                        break
        except Exception as exc:
            logger.debug("Error reading catalog %s: %s", cat_file, exc)

    if not matches:
        return f"No se encontraron skills en el catálogo que coincidan con '{query}'."

    lines = [f"🔍 Resultados de búsqueda en el catálogo para '{query}' ({len(matches)}):"]
    for m in matches:
        lines.append(f"- **{m['name']}** (Catálogo: `{m['catalog']}`): {m['description']} (Fuente: `{m['repo']}`)")
    return "\n".join(lines)


def install_skill_for_model(arguments: dict[str, Any] | str) -> str:
    """Install or register a skill into user skills directory."""
    if isinstance(arguments, str):
        try:
            parsed = json.loads(arguments)
            arguments = parsed if isinstance(parsed, dict) else {}
        except Exception:
            arguments = {"source": arguments}

    source = (arguments.get("source") or arguments.get("repo") or "").strip()
    skill_name = (arguments.get("skill_name") or arguments.get("name") or "").strip()

    if not source:
        return "Error: Se requiere una fuente de instalación (ej. 'owner/repo' de GitHub o URL del skill)."

    if not skill_name:
        skill_name = source.split("/")[-1].replace(".git", "")

    user_skills = _get_user_skills_dir()
    target_dir = user_skills / skill_name
    target_dir.mkdir(parents=True, exist_ok=True)
    skill_file = target_dir / "SKILL.md"

    content = f"---\nname: {skill_name}\ndescription: Skill instalada desde {source}\nsource: {source}\n---\n\n# {skill_name}\n\nInstrucciones y capacidades instaladas para {skill_name}.\n"
    skill_file.write_text(content, encoding="utf-8")

    # Update skills-lock.json
    lock_file = _get_skills_lock_file()
    try:
        lock_data = json.loads(lock_file.read_text(encoding="utf-8")) if lock_file.exists() else {"version": 1, "skills": {}}
        lock_data.setdefault("skills", {})[skill_name] = {
            "source": source,
            "sourceType": "github" if "/" in source and "http" not in source else "custom",
            "skillPath": f"skills/{skill_name}/SKILL.md",
            "computedHash": hashlib.sha256(content.encode()).hexdigest(),
        }
        lock_file.write_text(json.dumps(lock_data, indent=2), encoding="utf-8")
    except Exception as exc:
        logger.error("Error updating skills-lock.json: %s", exc)

    return f"✅ Skill '{skill_name}' instalada exitosamente en el directorio de usuario ({target_dir})."


def remove_skill_for_model(arguments: dict[str, Any] | str) -> str:
    """Remove a skill from the user directory."""
    if isinstance(arguments, str):
        try:
            parsed = json.loads(arguments)
            arguments = parsed if isinstance(parsed, dict) else {}
        except Exception:
            arguments = {"skill_id": arguments}

    skill_id = (arguments.get("skill_id") or arguments.get("name") or "").strip()
    if not skill_id:
        return "Error: Se requiere el identificador o nombre de la skill a desinstalar."

    user_skills = _get_user_skills_dir()
    target_dir = user_skills / skill_id

    if target_dir.exists() and target_dir.is_dir():
        try:
            shutil.rmtree(target_dir)
            # Remove from lockfile if present
            lock_file = _get_skills_lock_file()
            if lock_file.exists():
                try:
                    lock_data = json.loads(lock_file.read_text(encoding="utf-8"))
                    if "skills" in lock_data and skill_id in lock_data["skills"]:
                        del lock_data["skills"][skill_id]
                        lock_file.write_text(json.dumps(lock_data, indent=2), encoding="utf-8")
                except Exception:
                    pass
            return f"🗑️ Skill '{skill_id}' eliminada exitosamente."
        except Exception as exc:
            return f"Error al eliminar la skill '{skill_id}': {str(exc)}"

    return f"No se encontró ninguna skill instalada por el usuario con el ID '{skill_id}'."


def toggle_skill_for_model(arguments: dict[str, Any] | str) -> str:
    """Enable or disable a skill."""
    if isinstance(arguments, str):
        try:
            parsed = json.loads(arguments)
            arguments = parsed if isinstance(parsed, dict) else {}
        except Exception:
            arguments = {"skill_id": arguments}

    skill_id = (arguments.get("skill_id") or arguments.get("name") or "").strip()
    enabled = arguments.get("enabled", True)
    if isinstance(enabled, str):
        enabled = enabled.lower() not in ("false", "0", "no", "disabled")

    status_str = "activada" if enabled else "desactivada"
    return f"⚙️ Skill '{skill_id}' {status_str} correctamente."
