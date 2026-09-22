import type { WorkspaceChangedFile } from "@/features/chat/stores/use-workspace-store";
import { cn } from "@/lib/utils";
import { FolderIcon } from "lucide-react";

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
  const chunks = getDiffChunksForFile(file);

  if (chunks.length === 0) {
    return (
      <p className="rounded-xl border border-border/60 p-4 text-xs text-muted-foreground">
        No hay diferencias de texto disponibles para este archivo.
      </p>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden shadow-xs">
      {/* File Diff Card Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40 border-b border-border/40 text-xs font-mono">
        <div className="flex items-center gap-2 min-w-0 truncate text-foreground/90">
          <FolderIcon className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="truncate font-medium">{file.path}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-medium text-[11px]">
          <span className="text-emerald-600 dark:text-emerald-400">
            +{file.additions}
          </span>
          <span className="text-rose-600 dark:text-rose-400">
            -{file.deletions}
          </span>
        </div>
      </div>

      {/* Chunks */}
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
                    {/* Old line number */}
                    <div className="w-8 shrink-0 px-1 text-right text-muted-foreground/50 select-none border-r border-border/20">
                      {line.oldLineNumber ?? ""}
                    </div>
                    {/* New line number */}
                    <div className="w-8 shrink-0 px-1 text-right text-muted-foreground/50 select-none border-r border-border/20">
                      {line.newLineNumber ?? ""}
                    </div>
                    {/* Code line content */}
                    <div className="px-2.5 py-0.5 whitespace-pre flex-1 font-mono">
                      {line.content}
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
