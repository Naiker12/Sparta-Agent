import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useAuiState } from "@assistant-ui/react";
import { ChatPanelsWorkspace, ChatPaneToolbar } from "../../src/features/chat/components/chat-panels-workspace";
import { ChatRuntimeProvider } from "../../src/features/chat/runtime-provider";
import { useChatRuntimeStore } from "../../src/features/chat/stores/chat-runtime-store";
import { useExternalProvidersStore } from "../../src/features/chat/stores/external-providers-store";
import { useChatPanelsStore, requestChatPane } from "../../src/features/chat/stores/chat-panels-store";
import { buildExternalModelId } from "../../src/features/chat/external-providers";
import { setLocale } from "../../src/i18n";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { Thread, ChatComposerModelSelectorProvider } from "../../src/components/assistant-ui/thread";
import { ApiProviderModelSelector } from "../../src/features/chat/components/api-provider-model-selector";
import { WorkspacePanelContainer } from "../../src/components/workspace-rail";
import "../../src/index.css";

await setLocale("es");
useExternalProvidersStore.getState().setProviders([{ id: "test-provider", providerType: "openai", name: "Test", baseUrl: "https://example.invalid/v1", models: ["model-a", "model-b"], hasApiKey: true }]);
useExternalProvidersStore.getState().setConnectionsEnabled(true);
useChatRuntimeStore.setState({ settingsHydrated: true, activeThreadId: "primary", autoTitle: false, incognito: false, params: { ...useChatRuntimeStore.getState().params, checkpoint: buildExternalModelId("test-provider", "model-a") } });
const lifecycle = { mounts: 0, unmounts: 0 };
function Probe() {
  const messages = useAuiState(({thread}) => thread.messages);
  useEffect(() => { lifecycle.mounts++; return () => { lifecycle.unmounts++; }; }, []);
  return <><ChatPaneToolbar sourceId="primary" /><div data-testid="primary-message" className="flex min-h-0 flex-1 flex-col"><ChatComposerModelSelectorProvider selector={<ApiProviderModelSelector models={[]} value={useChatRuntimeStore.getState().params.checkpoint} onValueChange={() => {}} />}><Thread targetThreadId="primary" /></ChatComposerModelSelectorProvider></div></>;
}
Object.assign(window, { panelHarness: { open: requestChatPane, store: useChatPanelsStore, runtime: useChatRuntimeStore, lifecycle } });
createRoot(document.getElementById("root")!).render(<TooltipProvider><button style={{position: "fixed", right: 60, top: 5, width: 32, height: 32, zIndex: 100}} aria-label="Nuevo chat en panel" onClick={() => window.dispatchEvent(new Event("spartan:new-chat-pane"))}>+</button><div style={{height: "100vh", display: "flex"}}><ChatPanelsWorkspace primaryThreadId="primary"><ChatRuntimeProvider initialThreadId="primary" listThreads={false}><Probe /></ChatRuntimeProvider></ChatPanelsWorkspace><div className="hidden min-h-0 shrink-0 md:flex"><WorkspacePanelContainer /></div></div></TooltipProvider>);
