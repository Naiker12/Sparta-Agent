import React from "react";
import { createRoot } from "react-dom/client";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { AutomationsPage } from "../../src/features/tasks/automations-page";
import { AutomationNotifications } from "../../src/features/tasks/automation-notifications";
import { AutomationProposalCard } from "../../src/features/tasks/automation-proposal-card";
import { AssistantRuntimeProvider, ComposerPrimitive, useLocalRuntime } from "@assistant-ui/react";
import { ComposerToolsMenu } from "../../src/components/assistant-ui/thread/composer-tools-menu";
import { useExternalProvidersStore } from "../../src/features/chat/stores/external-providers-store";
import { setLocale } from "../../src/i18n";
import "../../src/index.css";

setLocale("es");
useExternalProvidersStore.getState().setProviders([
  {
    id: "test-provider",
    providerType: "openai",
    name: "Test API",
    baseUrl: "https://example.test/v1",
    models: ["scheduled-model", "replacement-model"],
    createdAt: 1,
    updatedAt: 1,
  },
]);
function NotificationHarness() {
  const location = useRouterState({ select: state => state.location });
  return <><AutomationNotifications /><output data-testid="location">{location.href}</output></>;
}
function ProposalHarness() {
  return <AutomationProposalCard plan={{title:"Daily research",prompt:"Research public news and summarize sources",scheduleType:"weekly",weekdays:[0,1,2,3,4],localTime:"09:00",timezone:"America/Bogota",webAccess:true}} />;
}
function ComposerHarness() {
  const runtime = useLocalRuntime({ async *run() { yield { content: [{type:"text" as const, text:"Fixture response"}] }; } });
  return <AssistantRuntimeProvider runtime={runtime}><ComposerPrimitive.Root><ComposerPrimitive.Input placeholder="Task instructions" /><ComposerToolsMenu researchAvailable={false} /></ComposerPrimitive.Root></AssistantRuntimeProvider>;
}
const query = new URLSearchParams(window.location.search);
const route = createRootRoute({ component: query.has("notifications") ? NotificationHarness : query.has("proposal") ? ProposalHarness : query.has("composer") ? ComposerHarness : AutomationsPage });
const router = createRouter({
  routeTree: route,
  history: createMemoryHistory({ initialEntries: ["/"] }),
});
createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
);
