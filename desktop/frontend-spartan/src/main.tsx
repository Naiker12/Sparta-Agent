
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { App } from "./app/app";
import { BackendSetupGate } from "./features/setup/backend-setup-gate";
import { fetchDeviceType } from "./config/env";
import { initializeLocale } from "./i18n";
import { isTauri, setApiBase, setBackendError } from "./lib/api-base";
import { watchOverlayScrollbarGutter } from "./lib/overlay-scrollbar";

declare global {
  interface Window {
    electronAPI?: {
      getBackendPort?: () => Promise<number | null>;
      getBackendStatus?: () => Promise<{ port?: number; error?: string }>;
      onBackendReady?: (listener: (port: number) => void) => () => void;
      bootstrapBackend?: () => Promise<{ ok: boolean; error?: string }>;
      onBackendError?: (listener: (message: string) => void) => () => void;
      onBackendInstallProgress?: (listener: (message: string) => void) => () => void;
      onBackendInstallComplete?: (listener: () => void) => () => void;
      onBackendInstallError?: (listener: (message: string) => void) => () => void;
    };
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
const root = createRoot(rootElement);

if (isTauri) {
  document.documentElement.classList.add("tauri");
}

// Rasterization follows the browser OS, not the potentially remote server.
// This adjustment is calibrated for desktop Linux, so exclude Android.
const uaLower = navigator.userAgent.toLowerCase();
if (uaLower.includes("linux") && !uaLower.includes("android")) {
  document.documentElement.classList.add("render-linux");
}

// Keep right-edge controls clear of overlay scrollbars.
watchOverlayScrollbarGutter(window);

function renderApp(): void {
  root.render(
    <StrictMode>
      <App />
      <BackendSetupGate />
    </StrictMode>,
  );
}

const localeInitialization = initializeLocale();
if (typeof localeInitialization !== "string") {
  localeInitialization.then(renderApp);
} else {
  renderApp();
}

// Tauri receives its loopback port asynchronously. TauriWrapper performs this
// fetch after the validated `server-port` event, so an eager request here would
// only hit Vite's proxy before the backend exists during development.
if (!isTauri) {
  const applyElectronPort = (port: number) => {
    setApiBase(port);
    void fetchDeviceType().catch(() => undefined);
  };
  void window.electronAPI?.getBackendPort?.().then((port) => {
    if (typeof port === "number") applyElectronPort(port);
  });
  void window.electronAPI?.getBackendStatus?.().then((status) => {
    if (typeof status.port === "number") applyElectronPort(status.port);
    if (status.error) setBackendError(status.error);
  });
  window.electronAPI?.onBackendReady?.(applyElectronPort);
  window.electronAPI?.onBackendError?.(setBackendError);
  fetchDeviceType().catch(() => undefined);
}
