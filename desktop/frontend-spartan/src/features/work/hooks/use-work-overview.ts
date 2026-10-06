import { useCallback, useEffect, useState } from "react";
import { translate } from "@/i18n";
import { AUTH_SESSION_CLEARED_EVENT } from "@/features/auth";
import { readWorkOverview } from "../api/work-runs-api";
import type { WorkOverview } from "../types";

export function useWorkOverview(offset: number) {
  const [data, setData] = useState<WorkOverview>({
    runs: [],
    hasMore: false,
    offset: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refresh = useCallback(
    () => setRefreshVersion((version) => version + 1),
    [],
  );
  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    let polling = false;
    const load = async (showLoading = false) => {
      if (disposed || polling) return;
      polling = true;
      controller = new AbortController();
      try {
        if (showLoading) {
          await Promise.resolve();
          if (disposed) return;
          setLoading(true);
        }
        const result = await readWorkOverview(offset, controller.signal);
        if (!disposed) {
          setData(result);
          setError(null);
        }
      } catch (failure) {
        if (!disposed)
          setError(
            failure instanceof Error
              ? failure.message
              : translate("channels.work.loadFailed"),
          );
      } finally {
        polling = false;
        if (!disposed) setLoading(false);
      }
    };
    const clear = () => {
      disposed = true;
      controller?.abort();
      setData({ runs: [], hasMore: false, offset: 0 });
      setLoading(false);
      setError(null);
    };
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, clear);
    void load(true);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5_000);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(interval);
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, clear);
    };
  }, [offset, refreshVersion]);
  return { ...data, loading, error, refresh };
}
