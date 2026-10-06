import { useCallback, useEffect, useRef, useState } from "react";
import { channelsApi } from "./api";
import type { ChannelOverview } from "./types";

export function useChannels() {
  const [data, setData] = useState<ChannelOverview>();
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    try {
      const result = await channelsApi.overview(next.signal);
      if (!next.signal.aborted) {
        setData(result);
        setError(false);
      }
    } catch {
      if (!next.signal.aborted) setError(true);
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
    };
  }, [refresh]);
  return { data, error, refresh };
}
