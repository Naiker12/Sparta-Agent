import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {AssistantRuntimeProvider, MessagePrimitive, ThreadPrimitive, useAuiState, useLocalRuntime} from "@assistant-ui/react";
import {ConversationNavigator} from "../../src/components/assistant-ui/thread/conversation-navigator";
import {setLocale} from "../../src/i18n";
import "../../src/index.css";

function Message() {
  const message = useAuiState(({message}) => message);
  return <MessagePrimitive.Root data-chat-message-id={message.id} className="min-h-48 p-5">
    <MessagePrimitive.Parts />
  </MessagePrimitive.Root>;
}
function App() {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const runtime = useLocalRuntime({async *run() {yield {content: [{type: "text", text: "Next"}]};}}, {
    initialMessages: Array.from({length: 12}, (_, index) => ({
      id: `nav-message-${index}`, role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: [{type: "text" as const, text: `Contenido de prueba ${index + 1}. Vista previa del mensaje.`}],
    })),
  });
  return <AssistantRuntimeProvider runtime={runtime}><ThreadPrimitive.Root className="relative m-5 h-[550px] bg-background text-foreground">
    <div ref={setViewport} data-testid="nav-viewport" className="h-full overflow-y-auto pr-8">
      <ThreadPrimitive.Messages components={{UserMessage: Message, AssistantMessage: Message}} />
    </div>
    <ConversationNavigator viewport={viewport} bottom={12} onNavigate={() => {}} />
  </ThreadPrimitive.Root></AssistantRuntimeProvider>;
}
void setLocale("es").then(() => createRoot(document.getElementById("root")!).render(<App />));
