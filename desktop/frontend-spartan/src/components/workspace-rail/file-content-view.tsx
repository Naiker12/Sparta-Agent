import { useT as useUiT } from "@/i18n";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { MarkdownPreview } from "@/components/markdown/markdown-preview";
import { createCodePlugin } from "@/components/assistant-ui/code-plugin";
import { unslothDarkTheme, unslothLightTheme } from "@/components/assistant-ui/code-themes";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { fileLanguage, sourceFence } from "./file-source";

const code = createCodePlugin({ themes: [unslothLightTheme, unslothDarkTheme] });

export function FileContentView({ path, content, onClose }: { path: string; content: string; onClose: () => void }) {
  const uiT = useUiT();

  const [source, setSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const language = fileLanguage(path);
  const canPreview = language === "markdown" || /\.(pdf|docx|xlsx|pptx)$/i.test(path);
  const filename = path.split(/[\\/]/).pop() ?? path;
  return <section className="flex h-full min-h-0 flex-col bg-background" aria-label={uiT("ui.file_value0", { value0: String(filename) })}>
    <header className="flex shrink-0 flex-col gap-2 border-b p-3">
      <div className="flex items-center justify-between gap-2"><button type="button" onClick={onClose} className="text-xs text-primary">{uiT("ui.files")}</button><span className="truncate text-xs font-medium" title={path}>{filename}</span></div>
      <div className="flex items-center gap-2 text-xs">
        {canPreview && <button type="button" aria-pressed={!source} onClick={() => setSource(old => !old)} className="rounded-lg border px-2 py-1">{source ? uiT("chat.files.preview") : uiT("ui.view_source_code")}</button>}
        <button type="button" className="rounded-lg border px-2 py-1" onClick={() => void copyToClipboard(content).then(() => setCopied(true)).catch(() => setCopied(false))}>{copied ? uiT("chat.actions.copied") : uiT("chat.actions.copy")}</button>
        <span className="ml-auto text-muted-foreground">{language}</span>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto p-4 text-xs">
      {canPreview && !source ? <MarkdownPreview markdown={content} /> : <Streamdown mode="static" plugins={{code}} controls={{code:false}} shikiTheme={[unslothLightTheme, unslothDarkTheme]}>{sourceFence(content, language)}</Streamdown>}
    </div>
    <footer className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground">{uiT("ui.read_only")}{" "}{content.length.toLocaleString()} {" "}{uiT("ui.characters_preview_limit_100_000")}</footer>
  </section>;
}
