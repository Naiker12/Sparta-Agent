import { createRoot } from "react-dom/client";
import { DocumentPreviewSheet } from "../../src/features/rag/components/document-preview-sheet";
import { useDocumentPreviewStore } from "../../src/features/rag/components/preview-store";
import "../../src/index.css";

const blob = new Blob(["Proyecto,Lenguaje,Estado\n" + Array.from({length: 220}, (_, i) => `Proyecto ${i + 1},TypeScript,Activo`).join("\n")]);
function Fixture() {
  return <main className="p-8"><h1>Vista previa: comprobación manual</h1><button onClick={() => useDocumentPreviewStore.getState().openLocalPreview({blob, filename:"proyectos.csv",kind:"csv"})}>Abrir hoja</button><DocumentPreviewSheet /></main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
