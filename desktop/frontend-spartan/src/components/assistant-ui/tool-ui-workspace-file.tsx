import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { FileCheck2Icon, FilePlus2Icon, FileSymlinkIcon, FileTextIcon, FileX2Icon, FolderTreeIcon, SearchIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useT } from "@/i18n";
import { stringifyToolResult } from "@/lib/strip-ansi";
import { useDocumentPreviewStore, type LocalPreviewKind } from "@/features/rag/components/preview-store";
import { Button } from "@/components/ui/button";
import { CodeViewerModal } from "./code-viewer-modal";
import { CopyBtn } from "./tool-code-cell";
import { ToolFallbackContent, ToolFallbackRoot, ToolFallbackTrigger } from "./tool-fallback";

type FileToolArgs = { path?: string; destination?: string; type?: "file" | "directory"; content?: string; query?: string };
const filename = (path: string) => path.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) || path;

function sourceKind(path: string): LocalPreviewKind {
  const ext = path.split(".").at(-1)?.toLowerCase();
  if (ext === "html" || ext === "htm") return "html";
  if (["js", "mjs", "cjs", "ts", "tsx", "jsx", "css", "json", "xml", "svg", "py", "sql", "sh", "ps1", "yml", "yaml"].includes(ext ?? "")) return "code";
  return "text";
}

export const WorkspaceFileToolUI: ToolCallMessagePartComponent = ({ args, result, status, toolName }) => {
  const t = useT();
  const previewId = useId();
  const [sourceOpen, setSourceOpen] = useState(false);
  const values = (args ?? {}) as FileToolArgs;
  const path = values.path ?? "";
  const destination = values.destination ?? "";
  const content = typeof values.content === "string" ? values.content : null;
  const resultText = result == null ? "" : stringifyToolResult(result);
  const failed = resultText.trimStart().startsWith("Error:") || status?.type === "incomplete";
  const running = status?.type === "running";
  const isWrite = toolName === "write_file";
  const isCreate = toolName === "create_file";
  const isDelete = toolName === "delete_path";
  const isRead = toolName === "read_file";
  const isList = toolName === "list_directory";
  const isSearch = toolName === "search_in_files";
  const shownPath = path || (isSearch ? values.query ?? "" : "");
  const title = filename(path) || t("chat.tools.workspaceFile.file");
  const Icon = isWrite ? FileCheck2Icon : isCreate ? FilePlus2Icon : isDelete ? FileX2Icon : isRead ? FileTextIcon : isList ? FolderTreeIcon : isSearch ? SearchIcon : FileSymlinkIcon;
  const actionLabel = useMemo(() => {
    if (failed) return t("chat.tools.workspaceFile.failed", { path: title });
    const key = isWrite ? (running ? "writing" : "wrote") : isCreate ? (running ? "creating" : "created") : isDelete ? (running ? "deleting" : "deleted") : isRead ? (running ? "reading" : "read") : isList ? (running ? "listing" : "listed") : isSearch ? (running ? "searching" : "searched") : (running ? "renaming" : "renamed");
    return t(`chat.tools.workspaceFile.${key}` as Parameters<typeof t>[0], { path: isSearch ? values.query ?? "" : title });
  }, [failed, isCreate, isDelete, isList, isRead, isSearch, isWrite, running, t, title, values.query]);
  const kind = sourceKind(path);
  const htmlIsSelfContained = kind === "html" && !/<(?:link|script|img|source)\b[^>]+(?:href|src)=/i.test(content ?? "") && !/\bsrcset\s*=/i.test(content ?? "");

  const openSource = (source: string, sourcePath = path, forceCode = false) => {
    if (!source || !sourcePath) return;
    if (forceCode) {
      useDocumentPreviewStore.getState().openLocalPreview({
        blob: new Blob([source], { type: "text/plain" }),
        filename: sourcePath,
        kind: "code",
        previewId: `workspace-tool:${previewId}`,
      });
      return;
    }
    if (kind === "html" && !htmlIsSelfContained) {
      setSourceOpen(true);
      return;
    }
    useDocumentPreviewStore.getState().openLocalPreview({
      blob: new Blob([source], { type: kind === "html" ? "text/html" : "text/plain" }),
      filename: path,
      kind,
      ...(kind === "html" && htmlIsSelfContained ? { previewCode: source } : {}),
      previewId: `workspace-tool:${previewId}`,
    });
  };

  return <>
    <ToolFallbackRoot defaultOpen={running || failed} data-workspace-file-tool={toolName} data-workspace-file-path={path}>
      <ToolFallbackTrigger toolName={`${actionLabel}: ${title}`} status={status} icon={Icon} />
      <ToolFallbackContent>
      <div className="space-y-2 rounded-lg border border-border/60 p-3 text-xs">
          <div className="break-all font-mono text-foreground/90">{toolName === "rename_path" && destination ? <>{path} <span className="text-muted-foreground">→</span> {destination}</> : shownPath}</div>
          {isCreate && <p className="text-muted-foreground">{values.type === "directory" ? t("chat.tools.workspaceFile.emptyDirectory") : t("chat.tools.workspaceFile.emptyFile")}</p>}
          {content !== null && <p className="text-muted-foreground">{t("chat.tools.workspaceFile.sourceLength", { count: content.length })}</p>}
          {resultText && (isRead || isList || isSearch) && !failed ? <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 font-mono text-[11px] leading-relaxed">{resultText}</pre> : resultText && <p className={failed ? "break-words text-destructive" : "break-words text-muted-foreground"}>{resultText.split("\n", 1)[0]}</p>}
          {isWrite && content !== null && !failed && !running && <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => openSource(content)}>{kind === "html" && htmlIsSelfContained ? t("chat.tools.workspaceFile.previewHtml") : t("chat.tools.workspaceFile.viewSource")}</Button>
            {kind !== "html" && <CopyBtn text={content} />}
          </div>}
          {isRead && resultText && !failed && !running && <Button type="button" size="sm" variant="outline" onClick={() => openSource(resultText, path, true)}>{t("chat.tools.workspaceFile.openReadResult")}</Button>}
        </div>
      </ToolFallbackContent>
    </ToolFallbackRoot>
    {content !== null && !failed && <CodeViewerModal open={sourceOpen} onOpenChange={setSourceOpen} title={title} language={path.split(".").at(-1)?.toLowerCase() ?? "text"} actions={<CopyBtn text={content} />}>
      <pre className="h-full overflow-auto whitespace-pre p-4 font-mono text-xs leading-5">{content}</pre>
    </CodeViewerModal>}
  </>;
};
WorkspaceFileToolUI.displayName = "WorkspaceFileToolUI";
