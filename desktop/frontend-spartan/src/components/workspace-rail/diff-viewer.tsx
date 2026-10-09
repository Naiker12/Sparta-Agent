import type { WorkspaceChangedFile } from "@/features/chat/stores/use-workspace-store";
import { cn } from "@/lib/utils";
import { FileCodeIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { useTheme } from "@/features/settings";
import { fileLanguage } from "./file-source";
import type { BundledLanguage } from "shiki";

interface DiffLine {
  type: "context" | "addition" | "deletion";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

interface DiffChunk {
  header: string;
  lines: DiffLine[];
}

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function getDiffChunksForFile(file: WorkspaceChangedFile): DiffChunk[] {
  const chunks: DiffChunk[] = [];
  let current: DiffChunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of (file.diff ?? "").split("\n")) {
    const hunk = HUNK_HEADER_RE.exec(line);
    if (hunk) {
      current = { header: line, lines: [] };
      chunks.push(current);
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (!current || line.startsWith("\\ No newline")) {
      continue;
    }
    if (line.startsWith("+")) {
      current.lines.push({
        type: "addition",
        newLineNumber: newLine++,
        content: line,
      });
    } else if (line.startsWith("-")) {
      current.lines.push({
        type: "deletion",
        oldLineNumber: oldLine++,
        content: line,
      });
    } else if (line.startsWith(" ")) {
      current.lines.push({
        type: "context",
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
        content: line,
      });
    }
  }
  return chunks;
}

export function DiffViewer({ file }: { file: WorkspaceChangedFile }) {
  const t = useT();
  const { resolved } = useTheme();
  const [split, setSplit] = useState(false);
  const [tokens, setTokens] = useState<
    Array<Array<{ content: string; color?: string }>>
  >([]);

  const chunks = useMemo(() => getDiffChunksForFile(file), [file.diff]);
  const source = useMemo(
    () =>
      chunks
        .flatMap((chunk) => chunk.lines)
        .map((line) => line.content.slice(1))
        .join("\n"),
    [chunks],
  );
  useEffect(() => {
    let cancelled = false;
    setTokens([]);
    if (!source || source.length > 200_000) return;
    void Promise.all([
      import("shiki"),
      import("@/components/assistant-ui/code-themes"),
    ])
      .then(async ([shiki, themes]) => {
        const result = await shiki.codeToTokens(source, {
          lang: fileLanguage(file.path) as BundledLanguage,
          theme:
            resolved === "dark"
              ? themes.spartanDarkTheme
              : themes.spartanLightTheme,
        });
        if (!cancelled) setTokens(result.tokens);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [source, file.path, resolved]);
  function code(index: number, content: string) {
    return (
      tokens[index]?.map((token, key) => (
        <span key={key} style={{ color: token.color }}>
          {token.content}
        </span>
      )) ?? content.slice(1)
    );
  }
  let sourceLineIndex = 0;

  if (chunks.length === 0) {
    return (
      <p className="px-4 py-3 text-xs text-muted-foreground">
        {t("ui.no_text_differences_available_for_this_file")}
      </p>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/40 text-xs font-mono">
        <div className="flex items-center gap-2 min-w-0 truncate text-foreground/90">
          <FileCodeIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{file.path}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-medium text-[11px]">
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={split}
            onClick={() => setSplit((value) => !value)}
          >
            {t(split ? "chat.repository.unified" : "chat.repository.split")}
          </Button>
          <span className="text-emerald-600 dark:text-emerald-400">
            +{file.additions}
          </span>
          <span className="text-rose-600 dark:text-rose-400">
            -{file.deletions}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto text-[12px] font-mono leading-relaxed select-text">
        {chunks.map((chunk, chunkIdx) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: diff chunks have no ids
          <div key={chunkIdx} className="w-full">
            <div className="px-4 py-1 bg-muted/20 text-muted-foreground/80 text-[11px] font-semibold border-b border-border/20">
              {chunk.header}
            </div>
            <div className="divide-y divide-border/10">
              {chunk.lines.map((line, lineIdx) => {
                const isAdd = line.type === "addition";
                const isDel = line.type === "deletion";
                const highlighted = code(sourceLineIndex++, line.content);
                if (split)
                  return (
                    <div
                      key={lineIdx}
                      className="grid min-w-[700px] grid-cols-2 font-mono"
                    >
                      <div
                        className={cn(
                          "flex border-r border-border/40",
                          isDel && "bg-red-500/15",
                        )}
                      >
                        <span className="w-12 shrink-0 px-2 text-right text-muted-foreground select-none">
                          {line.oldLineNumber}
                        </span>
                        <span className="whitespace-pre px-2">
                          {!isAdd && highlighted}
                        </span>
                      </div>
                      <div className={cn("flex", isAdd && "bg-green-500/15")}>
                        <span className="w-12 shrink-0 px-2 text-right text-muted-foreground select-none">
                          {line.newLineNumber}
                        </span>
                        <span className="whitespace-pre px-2">
                          {!isDel && highlighted}
                        </span>
                      </div>
                    </div>
                  );

                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no ids
                  <div
                    key={lineIdx}
                    className={cn(
                      "flex items-stretch hover:brightness-95 transition-colors",
                      isAdd &&
                        "bg-emerald-500/10 text-emerald-950 dark:text-emerald-200",
                      isDel &&
                        "bg-rose-500/10 text-rose-950 dark:text-rose-200",
                      !(isAdd || isDel) && "text-foreground/80",
                    )}
                  >
                    <div className="w-8 shrink-0 px-1 text-right text-muted-foreground/50 select-none border-r border-border/20">
                      {line.oldLineNumber ?? ""}
                    </div>
                    <div className="w-8 shrink-0 px-1 text-right text-muted-foreground/50 select-none border-r border-border/20">
                      {line.newLineNumber ?? ""}
                    </div>
                    <div className="px-2.5 py-0.5 whitespace-pre flex-1 font-mono">
                      <span className="mr-2 select-none">
                        {isAdd ? "+" : isDel ? "−" : " "}
                      </span>
                      {highlighted}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
