
import {
  installProgressMessage,
  startupWaitingMessage,
  STATUS_MESSAGE_ROTATION_MS,
  type StartupMessage,
} from "@/components/tauri/startup-messages";
import { Spinner } from "@/components/ui/spinner";
import { translate } from "@/i18n";
import type { BackendStatus } from "@/hooks/use-tauri-backend";
import type { CopySupportDiagnosticsResult } from "@/lib/tauri-diagnostics";

import { LanguageSelect } from "@/features/settings/components/language-select";
import { ChevronDown as ChevronDownIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

interface StartupScreenProps {
  status: BackendStatus;
  logs: string[];
  error: string | null;
  currentStepIndex: number;
  progressDetail: string | null;
  startupMessage: StartupMessage;
  elevationPackages: string[];
  onInstall: () => void;
  onRetry: () => void;
  onRetryInstall: () => void;
  onApproveElevation: () => void;
  onStartServer: () => void;
  onCopyDiagnostics: () => Promise<CopySupportDiagnosticsResult>;
}

function DiagnosticsCopyActions({
  onCopyDiagnostics,
  children,
}: {
  onCopyDiagnostics: () => Promise<CopySupportDiagnosticsResult>;
  children: React.ReactNode;
}) {
  const [copying, setCopying] = useState(false);
  const [manualReport, setManualReport] = useState<string | null>(null);
  const [manualMessage, setManualMessage] = useState<string | null>(null);

  async function handleCopyDiagnostics() {
    setCopying(true);
    try {
      const result = await onCopyDiagnostics();
      if (result.ok) {
        setManualReport(null);
        setManualMessage(null);
      } else {
        setManualReport(result.report);
        setManualMessage(result.error ?? translate("shell.startup.copyFailed"));
      }
    } catch (error) {
      setManualReport(null);
      setManualMessage(translate("shell.startup.diagnosticsCopyFailed", { error: String(error) }));
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="mt-4 flex w-full flex-col items-center gap-3">
      <div className="flex gap-3">
        <ActionButton
          variant="secondary"
          onClick={() => void handleCopyDiagnostics()}
        >
          {copying ? translate("shell.startup.copying") : translate("shell.startup.copyDiagnostics")}
        </ActionButton>
        {children}
      </div>
      {manualMessage && (
        <p className="max-w-md text-center text-xs text-destructive">{manualMessage}</p>
      )}
      {manualReport && (
        <textarea
          readOnly
          value={manualReport}
          onFocus={(event) => event.currentTarget.select()}
          className="h-32 w-full max-w-md resize-none rounded-lg border border-border/50 bg-muted/30 p-2 font-mono text-ui-10 text-muted-foreground"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


const EASE_OUT_QUART: [number, number, number, number] = [0.165, 0.84, 0.44, 1];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Logo() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 text-center select-none">
      <div className="relative flex items-center justify-center">
        <div className="absolute -inset-4 rounded-full bg-primary/10 blur-2xl dark:bg-primary/20 pointer-events-none" />
        <img
          src="/spartan-logo.svg"
          alt="SPARTAN AGENT"
          aria-hidden="true"
          className="relative h-28 w-28 sm:h-36 sm:w-36 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.4)] transition-transform duration-300 hover:scale-105"
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-2xl sm:text-3xl font-black uppercase tracking-[0.12em] text-foreground"
          style={{ fontFamily: '"Hellix", sans-serif' }}
        >
          SPARTAN AGENT
        </span>
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  variant = "primary",
  children,
}: {
  onClick: () => void;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}) {
  const base = "rounded-lg px-5 py-2.5 text-sm font-medium cursor-pointer transition-colors";
  const styles =
    variant === "primary"
      ? `${base} bg-primary text-primary-foreground hover:bg-primary/80`
      : `${base} bg-muted text-foreground hover:bg-muted/80`;
  return (
    <button type="button" className={styles} onClick={onClick}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Per-status renderers
// ---------------------------------------------------------------------------

function CheckingContent() {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex flex-1 items-center">
        <Logo />
      </div>
      <div className="mb-10 flex flex-col items-center gap-2">
        <Spinner className="size-6 text-primary" />
        <p className="text-sm text-muted-foreground">{translate("shell.startup.checking")}</p>
      </div>
    </div>
  );
}

function NotInstalledContent({ onInstall }: { onInstall: () => void }) {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <Logo />
      </div>
      <div className="mb-10 flex flex-col items-center gap-3">
        <p
          className="text-ui-13 font-semibold tracking-[-0.01em] text-muted-foreground"
          style={{ fontFamily: '"Hellix", sans-serif' }}
        >
          {translate("shell.startup.installPrompt")}
        </p>
        <ActionButton onClick={onInstall}>
          {translate("shell.startup.getStarted")}
        </ActionButton>
      </div>
    </div>
  );
}

function useRotatingMessageIndex(): number {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(
      () => setMessageIndex((current) => current + 1),
      STATUS_MESSAGE_ROTATION_MS,
    );
    return () => window.clearInterval(interval);
  }, []);

  return messageIndex;
}

function InstallingContent({
  logs,
  currentStepIndex,
  progressDetail,
}: {
  logs: string[];
  currentStepIndex: number;
  progressDetail: string | null;
}) {
  const messageIndex = useRotatingMessageIndex();
  const message = installProgressMessage(currentStepIndex, messageIndex);
  const detailLines = progressDetail
    ? [...logs, progressDetail]
    : logs;

  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex flex-1 items-center">
        <Logo />
      </div>
      <div className="mb-10 flex w-full flex-col items-center gap-2">
        <Spinner className="size-6 text-primary" />
        <p className="text-sm font-bold text-foreground" aria-live="polite">
          {message.title}
        </p>
        <p className="text-sm text-muted-foreground">{message.subtitle}</p>
        {detailLines.length > 0 && (
          <details className="group mt-2 w-full max-w-sm text-left">
            <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">{translate("shell.startup.showInstallDetails")}</span>
              <span className="hidden group-open:inline">{translate("shell.startup.hideInstallDetails")}</span>
              <HugeiconsIcon
                icon={ChevronDownIcon}
                aria-hidden="true"
                strokeWidth={1.5}
                className="size-[13px] shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border/50 bg-muted/30 p-3 font-mono text-ui-10 leading-relaxed text-muted-foreground">
              {detailLines.join("\n")}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

function RepairingContent({
  logs,
  progressDetail,
}: {
  logs: string[];
  progressDetail: string | null;
}) {
  const detailLines = progressDetail
    ? [...logs, progressDetail]
    : logs;

  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex flex-1 items-center">
        <Logo />
      </div>
      <div className="mb-10 flex w-full flex-col items-center gap-2">
        <Spinner className="size-6 text-primary" />
        <p className="text-sm font-bold text-foreground">{translate("shell.startup.gettingReady")}</p>
        <p className="text-sm text-muted-foreground">{translate("shell.startup.gettingReadyHelp")}</p>
        {detailLines.length > 0 && (
          <details className="group mt-2 w-full max-w-sm text-left">
            <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">{translate("shell.startup.showSetupDetails")}</span>
              <span className="hidden group-open:inline">{translate("shell.startup.hideSetupDetails")}</span>
              <HugeiconsIcon
                icon={ChevronDownIcon}
                aria-hidden="true"
                strokeWidth={1.5}
                className="size-[13px] shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border/50 bg-muted/30 p-3 font-mono text-ui-10 leading-relaxed text-muted-foreground">
              {detailLines.join("\n")}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

function ClosingContent() {
  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex flex-1 items-center">
        <Logo />
      </div>
      <div className="mb-10 flex w-full flex-col items-center gap-2">
        <Spinner className="size-6 text-primary" />
        <p className="text-sm font-bold text-foreground" aria-live="polite">
          {translate("shell.startup.closing")}
        </p>
        <p className="text-sm text-muted-foreground">{translate("shell.startup.shuttingDown")}</p>
      </div>
    </div>
  );
}

function InstallErrorContent({
  error,
  onRetryInstall,
  onCopyDiagnostics,
}: {
  error: string | null;
  onRetryInstall: () => void;
  onCopyDiagnostics: () => Promise<CopySupportDiagnosticsResult>;
}) {
  return (
    <>
      <Logo />
      <div className="mt-8 flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-destructive">{translate("shell.startup.setupProblem")}</p>
        {error && (
          <p className="max-w-xs text-center text-xs text-muted-foreground">{error}</p>
        )}
        <DiagnosticsCopyActions onCopyDiagnostics={onCopyDiagnostics}>
          <ActionButton onClick={onRetryInstall}>{translate("shell.startup.tryAgain")}</ActionButton>
        </DiagnosticsCopyActions>
      </div>
    </>
  );
}

function RepairErrorContent({
  error,
  onRetry,
  onCopyDiagnostics,
}: {
  error: string | null;
  onRetry: () => void;
  onCopyDiagnostics: () => Promise<CopySupportDiagnosticsResult>;
}) {
  return (
    <>
      <Logo />
      <div className="mt-8 flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-destructive">{translate("shell.startup.updateFailed")}</p>
        {error && (
          <p className="max-w-md text-center text-xs text-muted-foreground">{error}</p>
        )}
        <DiagnosticsCopyActions onCopyDiagnostics={onCopyDiagnostics}>
          <ActionButton onClick={onRetry}>{translate("shell.startup.tryAgain")}</ActionButton>
        </DiagnosticsCopyActions>
      </div>
    </>
  );
}

function NeedsElevationContent({
  elevationPackages,
  onApproveElevation,
  onRetryInstall,
}: {
  elevationPackages: string[];
  onApproveElevation: () => void;
  onRetryInstall: () => void;
}) {
  return (
    <>
      <Logo />
      <div className="mt-8 flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-foreground">{translate("shell.startup.permissionNeeded")}</p>
        <p className="text-xs text-muted-foreground">
          {translate("shell.startup.packagesNeeded")}
        </p>
        <div className="mt-2 w-full max-w-xs rounded-lg bg-muted p-3 font-mono text-xs">
          {elevationPackages.map((pkg) => (
            <div key={pkg}>{pkg}</div>
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <ActionButton variant="secondary" onClick={onRetryInstall}>Cancel</ActionButton>
          <ActionButton onClick={onApproveElevation}>{translate("shell.startup.allow")}</ActionButton>
        </div>
      </div>
    </>
  );
}

function StartingContent({ message }: { message: StartupMessage }) {
  const messageIndex = useRotatingMessageIndex();
  const displayMessage = startupWaitingMessage(message, messageIndex);

  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex flex-1 items-center">
        <Logo />
      </div>
      <div className="mb-10 flex flex-col items-center gap-2">
        <Spinner className="size-6 text-primary" />
        <p className="text-sm text-muted-foreground">{displayMessage}</p>
      </div>
    </div>
  );
}

function StoppedContent({ onStartServer }: { onStartServer: () => void }) {
  return (
    <>
      <Logo />
      <div className="mt-8 flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-foreground">{translate("shell.startup.serverStopped")}</p>
        <div className="mt-4">
          <ActionButton onClick={onStartServer}>{translate("shell.startup.startServer")}</ActionButton>
        </div>
      </div>
    </>
  );
}

function ErrorContent({
  error,
  onRetry,
  onCopyDiagnostics,
}: {
  error: string | null;
  onRetry: () => void;
  onCopyDiagnostics: () => Promise<CopySupportDiagnosticsResult>;
}) {
  return (
    <>
      <Logo />
      <div className="mt-8 flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-destructive">{translate("shell.startup.somethingWrong")}</p>
        {error && (
          <p className="max-w-md text-center text-xs text-muted-foreground">{error}</p>
        )}
        <DiagnosticsCopyActions onCopyDiagnostics={onCopyDiagnostics}>
          <ActionButton onClick={onRetry}>{translate("shell.startup.tryAgain")}</ActionButton>
        </DiagnosticsCopyActions>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StartupScreen({
  status,
  logs,
  error,
  currentStepIndex,
  progressDetail,
  startupMessage,
  elevationPackages,
  onInstall,
  onRetry,
  onRetryInstall,
  onApproveElevation,
  onStartServer,
  onCopyDiagnostics,
}: StartupScreenProps) {
  function renderContent() {
    switch (status) {
      case "checking":
        return <CheckingContent />;
      case "not-installed":
        return <NotInstalledContent onInstall={onInstall} />;
      case "installing":
        return (
          <InstallingContent
            logs={logs}
            currentStepIndex={currentStepIndex}
            progressDetail={progressDetail}
          />
        );
      case "install-error":
        return (
          <InstallErrorContent
            error={error}
            onRetryInstall={onRetryInstall}
            onCopyDiagnostics={onCopyDiagnostics}
          />
        );
      case "repairing":
        return <RepairingContent logs={logs} progressDetail={progressDetail} />;
      case "repair-error":
        return (
          <RepairErrorContent
            error={error}
            onRetry={onRetry}
            onCopyDiagnostics={onCopyDiagnostics}
          />
        );
      case "needs-elevation":
        return (
          <NeedsElevationContent
            elevationPackages={elevationPackages}
            onApproveElevation={onApproveElevation}
            onRetryInstall={onRetryInstall}
          />
        );
      case "starting":
        return <StartingContent key={startupMessage} message={startupMessage} />;
      case "running":
        return null;
      case "stopped":
        return <StoppedContent onStartServer={onStartServer} />;
      case "error":
        return (
          <ErrorContent
            error={error}
            onRetry={onRetry}
            onCopyDiagnostics={onCopyDiagnostics}
          />
        );
    }
  }

  return (
    <StartupSurface>
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          className="flex h-full w-full flex-col items-center justify-center text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT_QUART }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </StartupSurface>
  );
}

/** The chrome both full-window screens sit in, so they agree on insets and scrolling. */
function StartupSurface({ children }: { children: ReactNode }) {
  return (
    <div className="relative box-border flex h-full w-full flex-col items-center overflow-y-auto bg-background pb-6 pt-[var(--studio-startup-top-inset,0px)]">
      {/* Keep the locale control below desktop window chrome. On narrow Tauri
          windows the titlebar buttons occupy the upper-right corner and would
          otherwise cover the trigger, clipping longer translated labels. */}
      <div className="absolute right-4 top-[calc(var(--studio-desktop-titlebar-height,0px)+0.375rem)] z-50 flex items-center gap-2">
        <LanguageSelect />
      </div>
      <div className="flex min-h-0 flex-1 w-full max-w-md items-center justify-center px-6">
        {children}
      </div>
    </div>
  );
}

/**
 * Shown from the moment a quit is requested until the process is gone. Separate from
 * StartupScreen because a quit can come from the running app, where no backend status
 * applies, and unanimated because it has to be on screen for the very next paint.
 *
 * A layer over the app rather than a replacement for it: a declined quit has to hand the
 * user back the tree they had, in-flight generations and unsaved drafts included. The
 * z-index clears the titlebar, the download stack and the floating panels above it:
 * it is Z_LAYER.STARTUP_SCREEN, which lib/z-layers puts over both.
 */
export function ClosingScreen() {
  return (
    // pointer-events-auto, not the inherited default: Radix parks pointer-events:none on
    // <body> while any modal layer is open, and a quit raised from the window controls,
    // the tray or Alt+F4 never closes that layer. Inheriting it would make the overlay
    // click-through onto the dialog it is hiding, so clicks meant for a screen that says
    // the app is closing would land on buttons the user can no longer see.
    <div className="pointer-events-auto fixed inset-0 z-[9999]">
      <StartupSurface>
        <div className="flex h-full w-full flex-col items-center justify-center text-center">
          <ClosingContent />
        </div>
      </StartupSurface>
    </div>
  );
}
