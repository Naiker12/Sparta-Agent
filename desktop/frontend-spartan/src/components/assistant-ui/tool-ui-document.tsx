import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { AlertCircleIcon, FileTextIcon } from "lucide-react";
import { memo } from "react";
// Avoid initializing the full message renderer while this tool UI loads.
// eslint-disable-next-line no-restricted-imports
import { useToolAwaitingApproval } from "@/features/chat/tool-approval";
import { useT } from "@/i18n";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isSandboxFileList, type SandboxFile } from "./sandbox-files";
import { SandboxFiles } from "./sandbox-files-view";

export function DocumentGenerationStatus({
  filename,
  waiting = false,
}: { filename?: string; waiting?: boolean }) {
  const t = useT();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={!waiting}
      className="relative my-3 flex max-w-[42rem] items-center gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card p-4"
    >
      {!waiting && (
        <div
          aria-hidden="true"
          className="artifact-card-shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none motion-reduce:transform-none"
        />
      )}
      <div
        aria-hidden="true"
        className="relative flex size-12 shrink-0 items-center justify-center rounded-xl border bg-background"
      >
        <FileTextIcon className="size-5 text-muted-foreground" />
        <Spinner className="absolute -bottom-1 -right-1 size-3.5 motion-reduce:animate-none" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-sm font-medium">
          {t(
            waiting
              ? "chat.tools.waitingApproval"
              : "chat.tools.generatingFile",
          )}
        </span>
        {filename && (
          <span className="truncate text-xs text-muted-foreground">
            {filename}
          </span>
        )}
        {!waiting && (
          <div aria-hidden="true" className="flex max-w-64 flex-col gap-1.5">
            <Skeleton className="h-1.5 w-full motion-reduce:animate-none" />
            <Skeleton className="h-1.5 w-2/3 motion-reduce:animate-none" />
          </div>
        )}
      </div>
    </div>
  );
}

const DocumentToolUIImpl: ToolCallMessagePartComponent = ({
  args,
  result,
  status,
  toolCallId,
}) => {
  const t = useT();
  const waiting = useToolAwaitingApproval(toolCallId);
  const rawFilename = (args as { filename?: unknown })?.filename;
  const filename = typeof rawFilename === "string" ? rawFilename : undefined;
  const value = result as {
    text?: string;
    sessionId?: string;
    files?: unknown;
  } | null;
  if (status?.type === "running")
    return <DocumentGenerationStatus filename={filename} waiting={waiting} />;
  const files =
    value && Array.isArray(value.files) && isSandboxFileList(value.files)
      ? (value.files as SandboxFile[])
      : [];
  if (files.length && value?.sessionId)
    return <SandboxFiles files={files} sessionId={value.sessionId} />;
  const text =
    typeof result === "string"
      ? result
      : typeof value?.text === "string"
        ? value.text
        : undefined;
  return (
    <Alert variant="destructive" className="my-2">
      <AlertCircleIcon />
      <AlertTitle>{t("chat.tools.fileCreationFailed")}</AlertTitle>
      {text && <AlertDescription>{text}</AlertDescription>}
    </Alert>
  );
};
export const DocumentToolUI = memo(
  DocumentToolUIImpl,
) as ToolCallMessagePartComponent;
