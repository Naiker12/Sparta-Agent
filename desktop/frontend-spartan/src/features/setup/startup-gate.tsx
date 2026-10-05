import { translate as uiTranslate } from "@/i18n";
import { useT as useUiT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  getTauriAuthFailure,
  tauriAutoAuth,
} from "@/features/auth/tauri-auto-auth";
import { setApiBase } from "@/lib/api-base";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type StartupState =
  | "checking"
  | "needs_setup"
  | "installing"
  | "ready"
  | "auth_failed";

/** Keeps the product closed until its required local backend is ready. */
export function StartupGate({ children }: { children: ReactNode }) {
  const uiT = useUiT();

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
    if (line.trim()) {
      setLogs((current) => [...current, line].slice(-300));
    }
  };

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) {
      setState("ready");
      return;
    }

    let active = true;
    let revision = 0;
    const authenticate = async (port: number) => {
      const attempt = ++revision;
      setApiBase(port);
      setState("checking");
      const authenticated = await tauriAutoAuth({ force: true });
      if (!active || attempt !== revision) {
        return;
      }
      if (authenticated) {
        setError(null);
        setState("ready");
        setHasEntered(true);
      } else {
        setError(
          getTauriAuthFailure() ??
            "No se pudo autenticar el backend local. Reinicia Sparta.",
        );
        setState("auth_failed");
      }
    };
    void api
      .getBackendStatus?.()
      .then((status) => {
        if (!active || revision > 0) {
          return;
        }
        if (typeof status.port === "number") {
          void authenticate(status.port);
        } else if (status.error) {
          setError(status.error);
          setState("needs_setup");
        } else {
          // No port and no error means the host is still starting the backend.
          setState("checking");
        }
      })
      .catch((reason: unknown) => {
        if (!active || revision > 0) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setState("auth_failed");
      });

    const removeReady = api.onBackendReady?.((port) => void authenticate(port));
    const removeError = api.onBackendError?.((message) => {
      revision++;
      appendLog(message);
      setError(message);
      setState("needs_setup");
    });
    const removeProgress = api.onBackendInstallProgress?.(appendLog);
    const removeInstallError = api.onBackendInstallError?.((message) => {
      appendLog(message);
      setError(message);
      setState("needs_setup");
    });
    return () => {
      active = false;
      removeReady?.();
      removeError?.();
      removeProgress?.();
      removeInstallError?.();
    };
  }, []);

  useEffect(() => {
    if (state !== "installing" || installStartedAt === null) {
      return;
    }
    const updateElapsed = () =>
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - installStartedAt) / 1000)),
      );
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [state, installStartedAt]);

  useEffect(() => {
    if (!isEntering || state === "checking") {
      return;
    }
    const timer = window.setTimeout(() => setHasEntered(true), 350);
    return () => window.clearTimeout(timer);
  }, [isEntering, state]);

  if (!hasEntered) {
    return (
      <main className="fixed inset-0 grid place-items-center overflow-hidden bg-background p-6 text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--primary)/18%,transparent_28%),radial-gradient(circle_at_82%_78%,var(--accent)/70%,transparent_35%)]" />
        <section className="relative w-full max-w-lg px-6 py-10 text-center sm:px-10">
          <img
            alt={uiT("ui.sparta_agent_logo")}
            className="mx-auto size-28 object-contain"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
          />
          <p className="mt-7 text-sm font-semibold tracking-wide text-primary">
            SPARTA AGENT
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {uiT("ui.your_local_workspace")}
          </h1>
          <p className="mt-4 text-pretty leading-7 text-muted-foreground">
            {uiT(
              "ui.chat_create_and_work_with_your_ai_providers_in_a_private_environm",
            )}
          </p>
          <Button
            className="mt-8 h-11 rounded-xl px-6"
            disabled={isEntering}
            onClick={() => setIsEntering(true)}
            size="lg"
            type="button"
          >
            {isEntering && (
              <Spinner
                data-icon="inline-start"
                label={uiT("ui.loading_sparta")}
              />
            )}
            {isEntering ? uiT("ui.loading_sparta_") : uiT("ui.enter_sparta")}
          </Button>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            {isEntering
              ? uiT("ui.preparing_the_interface_and_checking_local_services")
              : uiT(
                  "ui.on_first_launch_we_will_set_up_the_local_backend_required_to_use_",
                )}
          </p>
        </section>
      </main>
    );
  }

  if (state === "ready") {
    return <>{children}</>;
  }

  const installing = state === "installing";
  const checking = state === "checking";
  const authFailed = state === "auth_failed";
  const friendlyMessage = error?.includes("ModuleNotFoundError")
    ? uiTranslate("ui.backend_components_are_missing_sparta_can_install_and_verify_them")
    : error?.includes("aún no está preparado")
      ? uiTranslate("ui.the_local_backend_is_not_installed_on_this_computer_yet")
      : authFailed
        ? uiTranslate("ui.the_engine_is_installed_but_we_could_not_connect_your_session_ret")
        : (error ??
          "Instala el backend una vez para poder usar todas las funciones de Sparta.");
  const install = async () => {
    if (authFailed) {
      window.location.reload();
      return;
    }
    if (!window.electronAPI?.bootstrapBackend) {
      return;
    }
    setLogs(["[Sparta] Preparando backend local..."]);
    setError(null);
    setShowDetails(false);
    setInstallStartedAt(Date.now());
    setElapsedSeconds(0);
    setState("installing");
    const result = await window.electronAPI
      .bootstrapBackend()
      .catch((reason: unknown) => ({
        ok: false,
        error: reason instanceof Error ? reason.message : String(reason),
      }));
    if (!result.ok) {
      setError(result.error ?? "No se pudo preparar el backend.");
      setState("needs_setup");
    }
  };
  const installElapsed = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  return (
    <main className="fixed inset-0 grid place-items-center overflow-auto bg-muted/40 p-6 text-foreground">
      <section className="w-full max-w-2xl rounded-3xl border bg-card p-7 shadow-2xl sm:p-10">
        <div className="flex items-center gap-4">
          <img
            alt={uiT("ui.sparta_agent_logo")}
            className="size-14 rounded-2xl border bg-background p-2 object-contain"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
          />
          <div>
            <p className="text-sm font-semibold text-primary">
              {uiT("ui.initial_setup")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {uiT("ui.set_up_sparta_agent")}
            </h1>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border bg-muted/50 p-5">
          <p className="font-medium">
            {checking
              ? uiT("ui.checking_backend")
              : installing
                ? uiT("ui.installing_backend")
                : authFailed
                  ? uiT("ui.could_not_connect_the_session")
                  : uiT("ui.backend_pending")}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {checking
              ? uiT(
                  "ui.we_are_checking_whether_this_computer_has_everything_it_needs",
                )
              : friendlyMessage}
          </p>

          {installing && (
            <>
              <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                <span className="font-medium">
                  {uiT("ui.elapsed_time")} {installElapsed}
                </span>
                <span className="text-muted-foreground">
                  {uiT("ui.this_may_take_several_minutes")}
                </span>
              </div>
              <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-foreground p-4 font-mono text-xs leading-5 text-background whitespace-pre-wrap">
                {logText || uiT("ui.sparta_waiting_for_installer_output")}
              </pre>
            </>
          )}

          {!(checking || installing) && error && (
            <>
              <button
                className="mt-4 text-sm font-medium text-primary underline underline-offset-4"
                onClick={() => setShowDetails((visible) => !visible)}
                type="button"
              >
                {showDetails
                  ? uiT("ui.hide_technical_details")
                  : uiT("ui.show_technical_details")}
              </button>
              {showDetails && (
                <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-foreground p-4 font-mono text-xs leading-5 text-background whitespace-pre-wrap">
                  {error}
                </pre>
              )}
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
            {installing
              ? uiT("ui.installing")
              : authFailed
                ? uiT("ui.retry_connection")
                : uiT("ui.install_or_repair_backend")}
          </button>
        </div>
        {!installing && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {uiT("ui.setup_runs_only_once_and_leaves_sparta_ready_to_open")}
          </p>
        )}
      </section>
    </main>
  );
}
