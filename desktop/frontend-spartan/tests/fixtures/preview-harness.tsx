import { createRoot } from "react-dom/client";
import { DocumentPreviewSheet } from "../../src/features/rag/components/document-preview-sheet";
import { useDocumentPreviewStore } from "../../src/features/rag/components/preview-store";
import "../../src/index.css";

const blob = new Blob(["Proyecto,Lenguaje,Estado\n" + Array.from({length: 220}, (_, i) => `Proyecto ${i + 1},TypeScript,Activo`).join("\n")]);
function Fixture() {
  return <main className="p-8"><h1>Vista previa: comprobación manual</h1><div className="flex flex-col gap-4 items-start">
    <button onClick={() => useDocumentPreviewStore.getState().openLocalPreview({blob, filename:"proyectos.csv",kind:"csv"})}>Abrir hoja</button>
    <button onClick={() => useDocumentPreviewStore.getState().openLocalPreview({blob:new Blob(["# Documento de prueba\n\nTexto independiente para comprobar las pestañas."]),filename:"notas.md",kind:"text",attachmentId:"fixture-notes"})}>Abrir notas</button>
    <button onClick={async () => {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
      zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
      zip.file("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="600"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="48"/><w:color w:val="0055AA"/></w:rPr><w:t>SPARTAN</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Documento de prueba</w:t></w:r></w:p><w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Segunda página</w:t></w:r></w:p><w:p><w:r><w:t>Esta vista conserva márgenes, estilos y saltos de página.</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>');
      useDocumentPreviewStore.getState().openLocalPreview({blob:await zip.generateAsync({type:"blob"}),filename:"prueba.docx",kind:"word",attachmentId:"fixture-word"});
    }}>Abrir Word</button>
    <button onClick={() => useDocumentPreviewStore.getState().removeAttachmentPreview("fixture-word")}>Quitar adjunto Word</button>
  </div><DocumentPreviewSheet /></main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
