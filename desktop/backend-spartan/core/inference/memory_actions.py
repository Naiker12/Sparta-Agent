"""Model-facing long-term-memory actions kept outside the central dispatcher."""
from storage.studio.memory_tasks import list_memory, upsert_memory

def search_memory_for_model(arguments: dict) -> str:
    query = str(arguments.get("query", "")).strip()
    if not query:
        return "No memory query was provided."
    nodes = list_memory(query).get("nodes", [])[:8]
    if not nodes:
        return "No relevant long-term memory was found."
    return "\n".join(f"- {node['label']}: {node['content']}" for node in nodes)

def save_memory_for_model(arguments: dict) -> str:
    kind = str(arguments.get("type", "fact")).strip().lower()
    if kind not in {"fact", "preference", "entity", "event"}:
        kind = "fact"
    label = str(arguments.get("label", "")).strip()
    content = str(arguments.get("content", "")).strip()
    if not label or not content:
        return "Error: Memory label and content are required."
    try:
        saved = upsert_memory({"type": kind, "label": label, "content": content})
        return f"Recuerdo guardado con éxito en la memoria a largo plazo: [{saved.get('type')}] {saved.get('label')} - {saved.get('content')}"
    except Exception as e:
        return f"Error guardando recuerdo: {e}"
