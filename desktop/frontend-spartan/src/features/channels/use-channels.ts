import { useCallback, useEffect, useRef, useState } from "react";
import { channelsApi } from "./api";
import type { ChannelOverview } from "./types";

export function useChannels() {
  const [data, setData] = useState<ChannelOverview>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (controller.current) return;
    setLoading(true);
    const next = new AbortController();
    controller.current = next;
    try {
      const result = await channelsApi.overview(
        AbortSignal.any([next.signal, AbortSignal.timeout(15000)]),
      );
      if (!next.signal.aborted) {
        setData(result);
        setError(false);
      }
    } catch {
      if (!next.signal.aborted) setError(true);
    } finally {
      if (controller.current === next) {
        controller.current = null;
        if (!next.signal.aborted) setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 10000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      controller.current?.abort();
      controller.current = null;
    };
  }, [refresh]);
  return { data, error, loading, refresh };
}
