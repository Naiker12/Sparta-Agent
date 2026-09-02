import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type StartupState = "checking" | "needs_setup" | "installing" | "ready";

/** Keeps the product closed until its required local runtime is ready. */
export function StartupGate({ children }: { children: ReactNode }) {
  const [hasEntered, setHasEntered] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [state, setState] = useState<StartupState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [installStartedAt, setInstallStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
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
      } else {
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
      removeReady?.();
      removeError?.();
      removeProgress?.();
      removeComplete?.();
      removeInstallError?.();
    };
  }, []);

  useEffect(() => {
    if (state !== "installing" || installStartedAt === null) return;
    const updateElapsed = () =>
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - installStartedAt) / 1000)));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [state, installStartedAt]);

  useEffect(() => {
    if (!isEntering || state === "checking") return;
    const timer = window.setTimeout(() => setHasEntered(true), 350);
    return () => window.clearTimeout(timer);
  }, [isEntering, state]);

  if (!hasEntered) {
    return (
      <main className="fixed inset-0 grid place-items-center overflow-hidden bg-background p-6 text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--primary)/18%,transparent_28%),radial-gradient(circle_at_82%_78%,var(--accent)/70%,transparent_35%)]" />
        <section className="relative w-full max-w-lg px-6 py-10 text-center sm:px-10">
          <img alt="Logo de Sparta Agent" className="mx-auto size-28 object-contain brightness-0" src={`${import.meta.env.BASE_URL}spartan-logo.svg`} />
          <p className="mt-7 text-sm font-semibold tracking-wide text-primary">SPARTA AGENT</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Tu espacio de trabajo local</h1>
          <p className="mt-4 text-pretty leading-7 text-muted-foreground">
            Conversa, crea y trabaja con tus modelos en un entorno privado preparado en tu equipo.
          </p>
          <Button
            className="mt-8 h-11 rounded-xl px-6"
            disabled={isEntering}
            onClick={() => setIsEntering(true)}
            size="lg"
            type="button"
          >
            {isEntering && <Spinner data-icon="inline-start" label="Cargando Sparta" />}
            {isEntering ? "Cargando Sparta…" : "Entrar a Sparta"}
          </Button>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            {isEntering
              ? "Preparando la interfaz y verificando los servicios locales…"
              : "En el primer inicio prepararemos el motor local necesario para usar la aplicación."}
          </p>
        </section>
      </main>
    );
  }

  if (state === "ready") return <>{children}</>;

  const installing = state === "installing";
  const checking = state === "checking";
  const friendlyMessage = error?.includes("ModuleNotFoundError")
    ? "Faltan componentes del motor local. Sparta puede instalarlos y verificarlos automáticamente."
    : error?.includes("aún no está preparado")
      ? "El motor local aún no está instalado en este equipo."
      : "Instala el motor local una vez para poder usar todas las funciones de Sparta.";
  const install = async () => {
    if (!window.electronAPI?.bootstrapBackend) return;
    setLogs(["[Sparta] Preparando motor local..."]);
    setError(null);
    setShowDetails(false);
    setInstallStartedAt(Date.now());
    setElapsedSeconds(0);
    setState("installing");
    const result = await window.electronAPI.bootstrapBackend();
    if (!result.ok) {
      setError(result.error ?? "No se pudo preparar el motor local.");
      setState("needs_setup");
    }
  };
  const installElapsed = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  return (
    <main className="fixed inset-0 grid place-items-center overflow-auto bg-muted/40 p-6 text-foreground">
      <section className="w-full max-w-2xl rounded-3xl border bg-card p-7 shadow-2xl sm:p-10">
        <div className="flex items-center gap-4">
          <img alt="Logo de Sparta Agent" className="size-14 rounded-2xl border bg-background p-2 object-contain brightness-0" src={`${import.meta.env.BASE_URL}spartan-logo.svg`} />
          <div>
            <p className="text-sm font-semibold text-primary">CONFIGURACIÓN INICIAL</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Prepara Sparta Agent</h1>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border bg-muted/50 p-5">
          <p className="font-medium">{checking ? "Comprobando el motor local…" : installing ? "Instalando el motor local…" : "Motor local pendiente"}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {checking ? "Estamos verificando si este equipo ya tiene todo lo necesario." : friendlyMessage}
          </p>

          {installing && (
            <>
              <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                <span className="font-medium">Tiempo transcurrido: {installElapsed}</span>
                <span className="text-muted-foreground">Puede tardar varios minutos</span>
              </div>
              <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-foreground p-4 font-mono text-xs leading-5 text-background whitespace-pre-wrap">{logText || "[Sparta] Esperando salida del instalador..."}</pre>
            </>
          )}

          {!checking && !installing && error && (
            <>
              <button className="mt-4 text-sm font-medium text-primary underline underline-offset-4" onClick={() => setShowDetails((visible) => !visible)} type="button">
                {showDetails ? "Ocultar detalles técnicos" : "Ver detalles técnicos"}
              </button>
              {showDetails && <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-foreground p-4 font-mono text-xs leading-5 text-background whitespace-pre-wrap">{error}</pre>}
            </>
          )}
        </div>

        <div className="mt-7 flex justify-end">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            disabled={checking || installing}
            onClick={() => void install()}
            type="button"
          >
            {installing ? "Instalando…" : "Instalar motor local"}
          </button>
        </div>
        {!installing && <p className="mt-4 text-center text-xs text-muted-foreground">La instalación se realiza una sola vez y Sparta queda listo para abrir.</p>}
      </section>
    </main>
  );
}
