import { translate as uiTranslate } from "@/i18n";
import { useEffect, useState } from "react";
import { getThreadWorkspace, type WorkspaceAccess } from "../api/modules/workspaces-api";
import { getPendingWorkspace } from "../utils/pending-workspace";
import { isAssistantLocalThreadId } from "../utils/thread-ids";

export type FileScope = { id: string; connectedFolderPath: string; workspaceAccess: WorkspaceAccess; threadBinding: true };

export function useThreadFileScope(threadId: string | null) {
  const [scope, setScope] = useState<FileScope | null>(null);
  const [error, setError] = useState("");
  const [loadedThread, setLoadedThread] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let sequence = 0;
    let stopped = false;
    async function load() {
      const current = ++sequence;
      setScope(null); setError("");
      setLoadedThread(undefined);
      try {
        const saved = threadId && !isAssistantLocalThreadId(threadId) ? await getThreadWorkspace(threadId) : null;
        const pending = !threadId || isAssistantLocalThreadId(threadId) ? getPendingWorkspace() : null;
        const next: FileScope | null = saved
          ? { id: saved.bindingId, connectedFolderPath: saved.canonicalPath, workspaceAccess: saved.access, threadBinding: true }
          : pending ? {id: "sparta-draft-workspace", connectedFolderPath: pending.folder, workspaceAccess: pending.access, threadBinding: true} : null;
        if (!stopped && current === sequence) { setScope(next); setLoadedThread(threadId); }
      } catch { if (!stopped && current === sequence) { setError(uiTranslate("ui.could_not_recover_the_chat_folder")); setLoadedThread(threadId); } }
    }
    void load();
    const changed = () => void load();
    window.addEventListener("sparta:workspace-changed", changed);
    return () => { stopped = true; sequence++; window.removeEventListener("sparta:workspace-changed", changed); };
  }, [threadId]);
  return { scope: loadedThread === threadId ? scope : null, error, loading: loadedThread !== threadId };
}
