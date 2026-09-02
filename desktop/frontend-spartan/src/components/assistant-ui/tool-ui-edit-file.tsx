"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useToolArgsStatus } from "@assistant-ui/react";
import { FilePenLineIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { useT } from "@/i18n";
import { stringifyToolResult } from "@/lib/strip-ansi";

import { CodeViewerModal } from "./code-viewer-modal";
import { CopyBtn } from "./tool-code-cell";
import {
  ToolFallbackContent,
  ToolFallbackRoot,
  ToolFallbackTrigger,
} from "./tool-fallback";

function fileName(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) || path;
}

function languageFor(path: string): string {
  const extension = path.split(".").at(-1)?.toLowerCase() ?? "";
  return (
    (
      {
        ts: "typescript",
        tsx: "tsx",
        js: "javascript",
        jsx: "jsx",
        py: "python",
        rs: "rust",
        json: "json",
        css: "css",
        html: "html",
        md: "markdown",
        sh: "bash",
        ps1: "powershell",
        yml: "yaml",
        yaml: "yaml",
      } as Record<string, string>
    )[extension] ?? "text"
  );
}

function DiffLines({ oldText, newText }: { oldText: string; newText: string }) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  return (
    <div className="h-full overflow-auto py-3 font-mono text-xs leading-5">
      {oldText
        ? oldLines.map((line, index) => (
            <div
              key={`old-${index}`}
              className="flex min-w-max bg-red-500/10 text-red-700 dark:text-red-300"
            >
              <span className="w-10 shrink-0 select-none border-r border-red-500/20 px-2 text-right opacity-60">
                −
              </span>
              <span className="whitespace-pre px-3">{line || " "}</span>
            </div>
          ))
        : null}
      {newLines.map((line, index) => (
        <div
          key={`new-${index}`}
          className="flex min-w-max bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        >
          <span className="w-10 shrink-0 select-none border-r border-emerald-500/20 px-2 text-right opacity-60">
            +
          </span>
          <span className="whitespace-pre px-3">{line || " "}</span>
        </div>
      ))}
    </div>
  );
}

const EditFileToolUIImpl: ToolCallMessagePartComponent = ({
  args,
  result,
  status,
}) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const values = args as {
    path?: string;
    old_string?: string;
    new_string?: string;
  };
  const path = values.path ?? "";
  const oldText = values.old_string ?? "";
  const newText = values.new_string ?? "";
  const resultText = result == null ? "" : stringifyToolResult(result);
  const failed = resultText.trimStart().startsWith("Error:");
  const { propStatus } = useToolArgsStatus();
  const writing =
    status?.type === "running" &&
    Object.values(propStatus).some((value) => value === "streaming");
  const title = fileName(path) || t("chat.tools.editFile.file");
  const summary = useMemo(
    () =>
      oldText
        ? t("chat.tools.editFile.replaced")
        : t("chat.tools.editFile.created"),
    [oldText, t],
  );

  return (
    <>
      <ToolFallbackRoot defaultOpen={status?.type === "running" || failed}>
        <ToolFallbackTrigger
          toolName={`${writing ? t("chat.tools.editFile.editing") : summary}: ${title}`}
          status={status}
          icon={FilePenLineIcon}
        />
        <ToolFallbackContent>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="block w-full overflow-hidden rounded-lg border text-left transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="min-w-0 truncate text-xs font-medium">
                {path || title}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("chat.tools.editFile.viewDiff")}
              </span>
            </div>
            <div className="max-h-44 overflow-hidden">
              <DiffLines oldText={oldText} newText={newText} />
            </div>
          </button>
          {resultText && (
            <p
              className={
                failed
                  ? "mt-2 text-xs text-destructive"
                  : "mt-2 text-xs text-muted-foreground"
              }
            >
              {resultText.split("\n", 1)[0]}
            </p>
          )}
        </ToolFallbackContent>
      </ToolFallbackRoot>
      <CodeViewerModal
        open={open}
        onOpenChange={setOpen}
        title={title}
        language={languageFor(path)}
        actions={<CopyBtn text={newText} />}
      >
        <DiffLines oldText={oldText} newText={newText} />
      </CodeViewerModal>
    </>
  );
};

export const EditFileToolUI = memo(
  EditFileToolUIImpl,
) as unknown as ToolCallMessagePartComponent;
EditFileToolUI.displayName = "EditFileToolUI";
