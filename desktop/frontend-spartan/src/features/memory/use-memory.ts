import { useCallback, useEffect, useRef, useState } from "react";
import { translateMemory as translate } from "./memory-i18n";
import { authFetch } from "@/features/auth";
import type { MemoryGraphData, MemoryInput } from "./memory-types";

export function useMemory(query: string) {
  const [graph, setGraph] = useState<MemoryGraphData>({ nodes: [], edges: [] });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const response = await authFetch(
        `/api/memory/graph${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
      );
      if (!response.ok)
        throw new Error(
          translate("ui.could_not_load_memory_http_value0", { value0: response.status }),
        );
      const data = await response.json();
      if (request === generation.current) {
        setGraph(data);
        setError(null);
      }
    } catch (failure) {
      if (request === generation.current)
        setError(
          failure instanceof Error ? failure.message : translate("ui.connection_error"),
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 250);
    return () => {
      window.clearTimeout(timer);
      invalidate();
    };
  }, [refresh, invalidate]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  async function mutate(path: string, method: string, body?: unknown) {
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch(path, {
        method,
        ...(body
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      });
      if (!response.ok)
        throw new Error(
          translate("ui.could_not_save_the_change_http_value0", { value0: response.status }),
        );
      await refresh();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : translate("ui.error_saving"));
      return false;
    } finally {
      setSaving(false);
    }
  }
  return {
    graph,
    error,
    loading,
    saving,
    refresh,
    save: (data: MemoryInput, id?: string) =>
      mutate(
        `/api/memory/nodes${id ? `/${encodeURIComponent(id)}` : ""}`,
        id ? "PATCH" : "POST",
        data,
      ),
    remove: (id: string) =>
      mutate(`/api/memory/nodes/${encodeURIComponent(id)}`, "DELETE"),
    connect: (source: string, target: string, relation: string) =>
      mutate("/api/memory/edges", "POST", { source, target, relation }),
  };
}
