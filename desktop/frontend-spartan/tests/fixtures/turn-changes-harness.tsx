import { createRoot } from "react-dom/client";
import { AssistantRuntimeProvider, MessagePrimitive, ThreadPrimitive, useLocalRuntime } from "@assistant-ui/react";
import { MessageTurnChangesSummary } from "../../src/components/assistant-ui/turn-changes-summary";
import { useDocumentPreviewStore } from "../../src/features/rag/components/preview-store";
import { DocumentPreviewSheet } from "../../src/features/rag/components/document-preview-sheet";
import "../../src/index.css";

const query = new URLSearchParams(location.search);
function Fixture() {
  const runtime = useLocalRuntime({ async *run() {} }, { initialMessages: [{
    role: "assistant", content: [{ type: "text", text: "Done" }], metadata: { custom: { turnChanges: [{ threadId: "fixture", id: query.get("id") }] } },
  }] });
  return <main className="w-full max-w-[48rem] p-4" style={{ width: "calc(100vw - var(--document-preview-width, 0px) - 4rem)" }}><AssistantRuntimeProvider runtime={runtime}><ThreadPrimitive.Root><ThreadPrimitive.Messages components={{ AssistantMessage: () => <MessagePrimitive.Root><MessageTurnChangesSummary /></MessagePrimitive.Root> }} /></ThreadPrimitive.Root></AssistantRuntimeProvider><button onClick={() => useDocumentPreviewStore.getState().openLocalPreview({ blob: new Blob(["Other file preview"]), filename: "readme.txt", kind: "text", previewId: "fixture-readme" })}>Open other file</button><DocumentPreviewSheet /></main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
