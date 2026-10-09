import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { AlertCircleIcon, FileTextIcon } from "lucide-react";
import { memo } from "react";
import { useToolAwaitingApproval } from "@/features/chat";
import { useT } from "@/i18n";
import { Spinner } from "@/components/ui/spinner";
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
      className="my-3 flex items-center gap-3 py-2"
    >
      <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <FileTextIcon className="size-5 text-muted-foreground" />
        <Spinner className="absolute -bottom-1 -right-1 size-3.5 motion-reduce:animate-none" />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
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
  const filename = (args as { filename?: string })?.filename;
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
  const text = typeof result === "string" ? result : value?.text;
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
