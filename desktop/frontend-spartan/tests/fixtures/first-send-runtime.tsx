import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChatRuntimeProvider } from "../../src/features/chat/runtime-provider";
import { useAui, useAuiState } from "@assistant-ui/react";
import { useElectronDragBoundary } from "../../src/hooks/use-electron-drag-boundary";

export function mountTitlebarHarness() {
  function Header() {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(260);
    const [clicks, setClicks] = useState(0);
    useElectronDragBoundary(ref, true);
    Object.assign(window, {resizeTitlebarHarness: setWidth});
    return <div ref={ref} style={{position: "fixed", top: 0, left: 0, width, height: 38, display: "flex", justifyContent: "flex-end"}}>
      <button style={{width: 30}} onClick={() => setClicks(n => n + 1)}>Buscar en pruebas</button>
      <button style={{width: 30}} onClick={() => setClicks(n => n + 1)}>Cerrar barra en pruebas</button>
      <output data-testid="header-clicks">{clicks}</output>
    </div>;
  }
  const overlay = document.createElement("div");
  overlay.dataset.slot = "electron-window-drag-region";
  Object.assign(overlay.style, {position: "fixed", top: "0px", height: "38px", left: "48px", right: "112px", zIndex: "70"});
  document.body.append(overlay);
  const container = document.createElement("div");
  document.body.append(container);
  createRoot(container).render(<Header />);
}

export function mountRuntimeHarness() {
  const lifecycle = { mounts: 0, unmounts: 0 };
  function Probe() {
    const aui = useAui();
    const id = useAuiState(({ threads }) => threads.mainThreadId);
    Object.assign(window, { runtimeThreadId: id, runtimeAui: aui });
    useEffect(() => {
      lifecycle.mounts++;
      return () => { lifecycle.unmounts++; };
    }, []);
    return <div data-testid="runtime-ready">Ready</div>;
  }
  function Host() {
    const [threadId, setThreadId] = useState<string>();
    const [, setTick] = useState(0);
    Object.assign(window, { adoptRuntimeThread: setThreadId, rerenderRuntime: () => setTick(tick => tick + 1) });
    return <ChatRuntimeProvider initialThreadId={threadId} listThreads={false}>
      <Probe />
    </ChatRuntimeProvider>;
  }
  Object.assign(window, { runtimeLifecycle: lifecycle });
  const container = document.createElement("div");
  document.body.append(container);
  createRoot(container).render(<Host />);
}
