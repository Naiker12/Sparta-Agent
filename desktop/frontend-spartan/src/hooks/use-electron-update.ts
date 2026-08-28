import { useCallback, useEffect, useState } from "react";

export type ElectronUpdaterStage =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface ElectronUpdaterState {
  stage: ElectronUpdaterStage;
  version?: string;
  releaseNotes?: string;
  percent?: number;
  error?: string;
}

type ElectronUpdaterAPI = {
  check: () => Promise<{ ok: boolean; error?: string }>;
  download: () => Promise<{ ok: boolean; error?: string }>;
  install: () => Promise<{ ok: boolean; error?: string }>;
  getState: () => Promise<ElectronUpdaterState>;
  onState: (callback: (state: ElectronUpdaterState) => void) => () => void;
};

function getUpdaterAPI(): ElectronUpdaterAPI | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { electronAPI?: { updater?: ElectronUpdaterAPI } })
    .electronAPI?.updater ?? null;
}

export function useElectronUpdate() {
  const [state, setState] = useState<ElectronUpdaterState>({ stage: "idle" });
  const api = getUpdaterAPI();

  useEffect(() => {
    if (!api) return;
    const unsubscribe = api.onState(setState);
    void api.getState().then(setState).catch(() => undefined);
    return unsubscribe;
  }, [api]);

  const download = useCallback(async () => {
    if (!api) return;
    const result = await api.download();
    if (!result.ok) setState((current) => ({ ...current, stage: "error", error: result.error }));
  }, [api]);
  const check = useCallback(async () => {
    if (!api) return;
    const result = await api.check();
    if (!result.ok) setState((current) => ({ ...current, stage: "error", error: result.error }));
  }, [api]);
  const installAndRestart = useCallback(async () => {
    if (!api) return;
    const result = await api.install();
    if (!result.ok) setState((current) => ({ ...current, stage: "error", error: result.error }));
  }, [api]);

  return { available: !!api, state, check, download, installAndRestart };
}
