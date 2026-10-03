import { useState } from "react";
import { Streamdown } from "streamdown";
import { MarkdownPreview } from "@/components/markdown/markdown-preview";
import { createCodePlugin } from "@/components/assistant-ui/code-plugin";
import { unslothDarkTheme, unslothLightTheme } from "@/components/assistant-ui/code-themes";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { fileLanguage, sourceFence } from "./file-source";

const code = createCodePlugin({ themes: [unslothLightTheme, unslothDarkTheme] });

export function FileContentView({ path, content, onClose }: { path: string; content: string; onClose: () => void }) {
  const [source, setSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const language = fileLanguage(path);
  const canPreview = language === "markdown" || /\.(pdf|docx|xlsx|pptx)$/i.test(path);
  const filename = path.split(/[\\/]/).pop() ?? path;
  return <section className="flex h-full min-h-0 flex-col bg-background" aria-label={`Archivo ${filename}`}>
    <header className="flex shrink-0 flex-col gap-2 border-b p-3">
      <div className="flex items-center justify-between gap-2"><button type="button" onClick={onClose} className="text-xs text-primary">← Archivos</button><span className="truncate text-xs font-medium" title={path}>{filename}</span></div>
      <div className="flex items-center gap-2 text-xs">
        {canPreview && <button type="button" aria-pressed={!source} onClick={() => setSource(old => !old)} className="rounded-lg border px-2 py-1">{source ? "Vista previa" : "Ver código fuente"}</button>}
        <button type="button" className="rounded-lg border px-2 py-1" onClick={() => void copyToClipboard(content).then(() => setCopied(true)).catch(() => setCopied(false))}>{copied ? "Copiado" : "Copiar"}</button>
        <span className="ml-auto text-muted-foreground">{language}</span>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto p-4 text-xs">
      {canPreview && !source ? <MarkdownPreview markdown={content} /> : <Streamdown mode="static" plugins={{code}} controls={{code:false}} shikiTheme={[unslothLightTheme, unslothDarkTheme]}>{sourceFence(content, language)}</Streamdown>}
    </div>
    <footer className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground">Solo lectura · {content.length.toLocaleString()} caracteres · límite de vista: 100.000</footer>
  </section>;
}
