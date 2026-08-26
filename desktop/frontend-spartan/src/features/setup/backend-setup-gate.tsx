import { useEffect, useState } from "react";

type SetupState = "idle" | "installing" | "failed";

/** Electron-only recovery UI for a missing or broken local Python runtime. */
export function BackendSetupGate() {
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [state, setState] = useState<SetupState>("idle");

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    void api.getBackendStatus?.().then((status) => {
      if (status.error) setMessage(status.error);
    });
    const removeError = api.onBackendError?.((error) => {
      setState("idle");
      setMessage(error);
    });
    const removeProgress = api.onBackendInstallProgress?.(setProgress);
    const removeComplete = api.onBackendInstallComplete?.(() => {
      setState("idle");
      setMessage(null);
      setProgress("");
    });
    const removeInstallError = api.onBackendInstallError?.((error) => {
      setState("failed");
      setMessage(error);
    });
    return () => {
      removeError?.();
      removeProgress?.();
      removeComplete?.();
      removeInstallError?.();
    };
  }, []);

  if (!message) return null;

  const install = async () => {
    if (!window.electronAPI?.bootstrapBackend) return;
    setState("installing");
    setProgress("Preparando instalaciÃ³n...");
    const result = await window.electronAPI.bootstrapBackend();
    if (!result.ok) {
      setState("failed");
      setMessage(result.error ?? "No se pudo instalar el motor local.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#352d40]/35 p-6" role="dialog" aria-modal="true" aria-labelledby="backend-setup-title">
      <section className="w-full max-w-xl rounded-2xl bg-[#fdf9f2] p-7 text-[#352d40] shadow-2xl">
        <p className="text-sm font-medium text-[#b42318]">Motor local no disponible</p>
        <h1 id="backend-setup-title" className="mt-2 text-2xl font-semibold">Configura Sparta Agent</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#625b6e]">{message}</p>
        {progress && <p className="mt-4 rounded-lg bg-[#f2ebe0] px-3 py-2 text-sm text-[#4c4554]">{progress}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-lg px-4 py-2 text-sm text-[#625b6e]" onClick={() => setMessage(null)} disabled={state === "installing"}>
            Continuar sin motor local
          </button>
          <button type="button" className="rounded-lg bg-[#2997ff] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void install()} disabled={state === "installing"}>
            {state === "installing" ? "Instalando..." : state === "failed" ? "Reintentar" : "Instalar motor local"}
          </button>
        </div>
      </section>
    </div>
  );
}
