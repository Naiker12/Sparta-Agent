import React, { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
} from "@assistant-ui/react";
import { MarkdownText } from "../../src/components/assistant-ui/markdown-text";
import { WebSearchToolUI } from "../../src/components/assistant-ui/tool-ui-web-search";
import { PresentUiToolUI } from "../../src/components/assistant-ui/tool-ui-present-ui";
import { UserFormSubmission } from "../../src/components/assistant-ui/user-form-submission";
import { ToolGroup } from "../../src/components/assistant-ui/tool-group";
import {
  Sources,
  SourcesGroup,
} from "../../src/components/assistant-ui/sources";
import { useChatPreferencesStore } from "../../src/features/chat/stores/chat-preferences-store";
import { setLocale } from "../../src/i18n";
import "../../src/index.css";

const table =
  "Comparación de datos de prueba.\n\n| Nombre | Cantidad (unidades) |\n| --- | --- |\n| Alpha | 2 |\n| Beta | -1 |\n| Gamma | 4 |";
const components = {
  Text: MarkdownText,
  Source: Sources,
  ToolGroup,
  tools: {
    by_name: { web_search: WebSearchToolUI, present_ui: PresentUiToolUI },
  },
};
function Assistant() {
  return (
    <MessagePrimitive.Root>
      <MessagePrimitive.Parts components={components} />
      <SourcesGroup allowRemoteIcons={false} />
    </MessagePrimitive.Root>
  );
}
function App() {
  const runtime = useLocalRuntime({
    async *run({ messages }) {
      const latest = messages
        .filter((m) => m.role === "user")
        .at(-1)
        ?.content.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      if (latest === "panel") {
        const panel = {
          version: 1,
          title: "Plan de prueba",
          layout: "stack",
          blocks: [
            { kind: "metric", label: "Total", value: "0" },
            {
              kind: "form",
              id: "details",
              title: "Datos del plan",
              fields: [
                { id: "name", label: "Nombre", type: "text", required: true },
                {
                  id: "count",
                  label: "Cantidad",
                  type: "number",
                  min: 0,
                  max: 10,
                  required: true,
                },
                { id: "active", label: "Activo", type: "checkbox" },
              ],
            },
          ],
        };
        yield {
          content: [
            {
              type: "tool-call",
              toolCallId: "panel-1",
              toolName: "present_ui",
              args: { panel },
              argsText: JSON.stringify({ panel }),
              result: JSON.stringify({
                kind: "response_panel",
                panel,
                fallbackText:
                  "Plan de prueba\nTotal: 0\nDatos del plan\nNombre\nCantidad\nActivo",
              }),
            },
          ],
        };
        return;
      }
      if (latest === "autochart") {
        yield {content: [{type: "text", text: "| Equipo | Ventas (unidades) |\n| --- | --- |\n| A | 2 |\n| B | 3 |\n| C | 4 |\n| D | 5 |"}]};
        return;
      }
      if (latest === "fuentes") {
        yield {content: [{type: "tool-call", toolCallId: "sources-1", toolName: "web_search", args: {query: "fuentes"}, argsText: '{"query":"fuentes"}', result: "Title: Fuente de prueba\nURL: https://example.org/report#one\nSnippet: Datos publicados en el informe original.\n---\nTitle: Duplicada\nURL: https://example.org/report#two\nSnippet: Mismo informe."}]};
        return;
      }
      if (latest?.startsWith("Plan de prueba —")) {
        yield { content: [{ type: "text", text: "Formulario recibido." }] };
        return;
      }
      const imageTurn = messages
        .filter((m) => m.role === "user")
        .at(-1)
        ?.content.some(
          (part) => part.type === "text" && part.text.includes("imagen"),
        );
      if (imageTurn)
        yield {
          content: [
            {
              type: "tool-call",
              toolCallId: "reference-1",
              toolName: "web_search",
              args: { query: "example", search_type: "images" },
              argsText: '{"query":"example","search_type":"images"}',
              result:
                "Title: Reference\nURL: https://example.org/page\nImage_URL: https://images.example.org/photo.png\nSnippet: metadata",
            },
            {
              type: "text",
              text: "Una referencia encontrada; consulta el origen.",
            },
          ],
        };
      else {
        yield { content: [{ type: "text", text: table.slice(0, 75) }] };
        await new Promise((resolve) => setTimeout(resolve, 30));
        yield { content: [{ type: "text", text: table }] };
      }
    },
  });
  const enabled = useChatPreferencesStore((s) => s.visualResponses);
  useEffect(() => {
    void setLocale("es");
  }, []);
  Object.assign(window, {
    openuiState: () => runtime.thread.getState(),
    openuiExport: () => runtime.thread.export(),
    openuiRestore: (value: ReturnType<typeof runtime.thread.export>) =>
      runtime.thread.import(value),
    openuiEnable: (value: boolean) =>
      useChatPreferencesStore.getState().setVisualResponses(value),
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        <button
          onClick={() =>
            useChatPreferencesStore.getState().setVisualResponses(!enabled)
          }
        >
          Presentación {enabled ? "activa" : "inactiva"}
        </button>
        <ThreadPrimitive.Root>
          <ThreadPrimitive.Messages
            components={{
              AssistantMessage: Assistant,
              UserMessage: () => (
                <MessagePrimitive.Root data-testid="user-submission">
                  <UserFormSubmission><MessagePrimitive.Parts /></UserFormSubmission>
                </MessagePrimitive.Root>
              ),
            }}
          />
          <ComposerPrimitive.Root>
            <ComposerPrimitive.Input aria-label="Mensaje" />
            <ComposerPrimitive.Send>Enviar</ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </main>
    </AssistantRuntimeProvider>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
