import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type StartupState = "checking" | "needs_setup" | "installing" | "ready" | "cloud";

/** Electron startup shell: the product is not mounted until its local runtime is ready. */
export function StartupGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StartupState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const logText = useMemo(() => logs.slice(-80).join("\n"), [logs]);
  const appendLog = (line: string) => {
    if (line.trim()) setLogs((current) => [...current, line].slice(-300));
  };

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) {
      setState("ready");
      return;
    }
    void api.getBackendStatus?.().then((status) => {
      if (typeof status.port === "number") setState("ready");
      else if (status.error) {
        setError(status.error);
        setState("needs_setup");
      }
    });
    const removeReady = api.onBackendReady?.(() => setState("ready"));
    const removeError = api.onBackendError?.((message) => {
      appendLog(message);
      setError(message);
      setState("needs_setup");
    });
    const removeProgress = api.onBackendInstallProgress?.(appendLog);
    const removeComplete = api.onBackendInstallComplete?.(() => setState("ready"));
    const removeInstallError = api.onBackendInstallError?.((message) => {
      appendLog(message);
      setError(message);
      setState("needs_setup");
    });
    return () => {
      removeReady?.(); removeError?.(); removeProgress?.(); removeComplete?.(); removeInstallError?.();
    };
  }, []);

  if (state === "ready" || state === "cloud") return <>{children}</>;
  const installing = state === "installing";
  const checking = state === "checking";
  const friendlyMessage = error?.includes("ModuleNotFoundError")
    ? "Faltan componentes del motor local. Sparta puede instalarlos y verificarlos automáticamente."
    : error?.includes("aún no está preparado")
      ? "El motor local aún no está instalado en este equipo."
      : "El motor local necesita una reparación antes de abrir Sparta.";
  const install = async () => {
    if (!window.electronAPI?.bootstrapBackend) return;
    setLogs(["[Sparta] Preparando motor local..."]);
    setError(null);
    setShowDetails(false);
    setState("installing");
    const result = await window.electronAPI.bootstrapBackend();
    if (!result.ok) {
      setError(result.error ?? "No se pudo preparar el motor local.");
      setState("needs_setup");
    }
  };

  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#352d40]/35 p-6" role="dialog" aria-modal="true">
    <section className="w-full max-w-2xl rounded-2xl bg-[#fdf9f2] p-7 text-[#352d40] shadow-2xl">
      <p className="text-sm font-medium text-[#b42318]">{checking ? "Comprobando motor local" : "Preparación del motor local"}</p>
      <h1 className="mt-2 text-2xl font-semibold">Prepara Sparta Agent</h1>
      <p className="mt-3 text-sm leading-6 text-[#625b6e]">
        {checking ? "Verificando Python, el entorno y las dependencias antes de abrir Sparta." : friendlyMessage}
      </p>
      {installing && <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-[#27232d] p-3 font-mono text-xs leading-5 text-[#e9e1ef] whitespace-pre-wrap">{logText || "[Sparta] Esperando salida del instalador..."}</pre>}
      {!checking && !installing && error && <>
        <button type="button" className="mt-4 text-sm font-medium text-[#625b6e] underline underline-offset-4" onClick={() => setShowDetails((visible) => !visible)}>
          {showDetails ? "Ocultar detalles técnicos" : "Ver detalles técnicos"}
        </button>
        {showDetails && <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-[#27232d] p-3 font-mono text-xs leading-5 text-[#e9e1ef] whitespace-pre-wrap">{error}</pre>}
      </>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="rounded-lg px-4 py-2 text-sm text-[#625b6e]" onClick={() => setState("cloud")} disabled={checking || installing}>Continuar sin motor local</button>
        <button type="button" className="rounded-lg bg-[#2997ff] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void install()} disabled={checking || installing}>{installing ? "Instalando..." : "Instalar motor local"}</button>
      </div>
    </section>
  </div>;
}
