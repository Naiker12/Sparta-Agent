import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
} from "@assistant-ui/react";
import { withRunErrorStatus } from "../../src/features/chat/utils/run-error-status";
import { useImeComposerInputHandlers } from "../../src/components/assistant-ui/thread/use-ime-composer";

function ComposerInput() {
  const { inputProps } = useImeComposerInputHandlers({ submitOnEnter: true });
  return <ComposerPrimitive.Input {...inputProps} aria-label="Mensaje" />;
}

let calls = 0;
function App() {
  const runtime = useLocalRuntime(withRunErrorStatus({
    async *run({ messages, abortSignal }) {
      calls++;
      const text = messages.filter((m) => m.role === "user").at(-1)?.content
        .filter((p) => p.type === "text").map((p) => p.text).join("") ?? "";
      yield { content: [{ type: "text", text: `Respuesta: ${text}` }] };
      if (text === "error") throw new Error("Error de conexión simulado");
      if (text === "cancelar") {
        await new Promise<void>((resolve) => {
          if (abortSignal.aborted) resolve();
          else abortSignal.addEventListener("abort", () => resolve(), { once: true });
        });
        return;
      }
    },
  }));
  Object.assign(window, {
    migrationState: () => ({ ...runtime.thread.getState(), calls }),
    migrationCancel: () => runtime.thread.cancelRun(),
  });
  return <AssistantRuntimeProvider runtime={runtime}>
    <ThreadPrimitive.Root>
      <ThreadPrimitive.Messages components={{
        UserMessage: () => <div data-testid="user"><MessagePrimitive.Parts /></div>,
        AssistantMessage: () => <div data-testid="assistant"><MessagePrimitive.Parts /></div>,
      }} />
      <ComposerPrimitive.Root>
        <ComposerInput />
        <ComposerPrimitive.Send>Enviar</ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  </AssistantRuntimeProvider>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
