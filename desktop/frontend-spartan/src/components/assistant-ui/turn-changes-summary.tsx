import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { FileDiffIcon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
// Reuse the shared preview Sheet and its existing tabs.
// eslint-disable-next-line no-restricted-imports
import { useDocumentPreviewStore, type TurnChangesPreview } from "@/features/rag/components/preview-store";
import { DiffViewer } from "@/components/workspace-rail/diff-viewer";
import { useT } from "@/i18n";
// Leaf API avoids initializing the chat renderer through its own feature barrel.
// eslint-disable-next-line no-restricted-imports
import { getTurnChanges, getTurnFileDiff, undoTurnChanges, readTurnChangeRefs, TurnChangesError, type TurnChangeRef, type TurnChangeSet, type TurnChangedFile } from "@/features/chat/api/modules/turn-changes-api";

function errorLabel(t: ReturnType<typeof useT>, error: unknown) {
  if (error instanceof TurnChangesError) {
    switch (error.code) {
      case "files_changed_since_turn": return t("chat.changes.conflict");
      case "workspace_busy": return t("chat.changes.busy");
      case "workspace_changed": return t("chat.changes.workspaceChanged");
      case "workspace_read_only": return t("chat.changes.readOnly");
    }
  }
  return t("chat.changes.failed");
}

function undoReasonLabel(t: ReturnType<typeof useT>, reason: TurnChangeSet["undoReason"]) {
  switch (reason) {
    case "capture_incomplete": return t("chat.changes.captureIncomplete");
    case "content_unavailable": return t("chat.changes.contentUnavailable");
    case "unverified_changes": return t("chat.changes.unverifiedChanges");
    case "workspace_not_writable": return t("chat.changes.readOnly");
    default: return t("chat.changes.undoUnavailable");
  }
}

export function MessageTurnChangesSummary() {
  const raw = useAuiState(({ message }) => message.metadata?.custom?.turnChanges);
  const captureError = useAuiState(({ message }) => message.metadata?.custom?.changeCaptureError);
  const running = useAuiState(({ message }) => message.status?.type === "running");
  const threadRunning = useAuiState(({ thread }) => thread.isRunning);
  const refs = useMemo(() => readTurnChangeRefs(raw), [raw]);
  const t = useT();
  if (running) return null;
  return <>
    {captureError && <p role="status" className="my-2 text-xs text-muted-foreground">{t("chat.changes.notCaptured")}</p>}
    {refs.map(ref => <TurnChangesSummary key={ref.id} changeRef={ref} disabled={threadRunning} />)}
  </>;
}

export function TurnChangesSummary({ changeRef, disabled = false }: { changeRef: TurnChangeRef; disabled?: boolean }) {
  const { id, threadId } = changeRef;
  const t = useT();
  const [data, setData] = useState<TurnChangeSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async (attempt = 0) => {
      try {
        const result = await getTurnChanges({ id, threadId });
        if (cancelled) return;
        setData(result);
        setError(null);
        if (result.state === "running") {
          if (attempt < 8) timer = setTimeout(() => void read(attempt + 1), 1000);
          else setError(t("chat.changes.unfinished"));
        }
      } catch (err) { if (!cancelled) setError(errorLabel(t, err)); }
    };
    void read();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [id, threadId, revision, t]);

  const restore = useCallback(async () => {
    setRestoring(true);
    setError(null);
    try {
      setData(await undoTurnChanges(changeRef));
      window.dispatchEvent(new Event("sparta:workspace-changed"));
    } catch (err) { setError(errorLabel(t, err)); }
    finally { setRestoring(false); }
  }, [changeRef, t]);

  if (!data && !error) return <p role="status" className="my-3 flex items-center gap-2 text-xs text-muted-foreground"><Spinner className="size-4" />{t("chat.changes.loading")}</p>;
  if (data?.state === "finished" && data.complete && !data.files.length) return null;
  const additions = data?.files.reduce((total, file) => total + (file.additions ?? 0), 0) ?? 0;
  const deletions = data?.files.reduce((total, file) => total + (file.deletions ?? 0), 0) ?? 0;
  const hasLineStats = data?.files.some(file => file.additions !== null);
  const showFile = (file: TurnChangedFile) => useDocumentPreviewStore.getState().openTurnChangesPreview({ ...changeRef, path: file.path }, t("chat.changes.view"));
  return <>
    <Card size="sm" data-chat-artifact-card className="my-2 w-full gap-0 rounded-xl py-0 data-[size=sm]:gap-0 data-[size=sm]:py-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 group-data-[size=sm]/card:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileDiffIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <CardTitle>{data?.state === "undone" ? t("chat.changes.undone") : !data?.files.length && !data?.complete ? t("chat.changes.partialTitle") : t("chat.changes.title", { count: data?.files.length ?? 0 })}</CardTitle>
            <CardDescription>{hasLineStats ? <><span className="text-diff-added" aria-label={t("chat.changes.addedLines", { count: additions })}>+{additions}</span>{" "}<span className="text-destructive" aria-label={t("chat.changes.removedLines", { count: deletions })}>−{deletions}</span></> : t("chat.changes.scope")}</CardDescription>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {data?.canUndo && <Button variant="ghost" size="sm" disabled={disabled || restoring} onClick={() => void restore()}>{restoring ? <Spinner data-icon="inline-start" /> : <Undo2Icon data-icon="inline-start" />}{t("chat.changes.undo")}</Button>}
          {!!data?.files.length && <Button variant="outline" size="sm" onClick={() => showFile(data.files[0])}>{t("chat.changes.view")}</Button>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-0 px-0 group-data-[size=sm]/card:px-0">
        {data?.files.map(file => <button key={file.path} type="button" title={file.path} className="flex min-w-0 items-center justify-between gap-3 border-t border-border/50 px-3 py-1.5 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => showFile(file)}>
          <span className="truncate text-xs font-medium">{file.path}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{file.binary ? t("chat.changes.binary") : <><span className="text-diff-added">+{file.additions}</span>{" "}<span className="text-destructive">−{file.deletions}</span></>}</span>
        </button>)}
        {data?.state === "running" && !error && <p role="status" className="px-4 py-2 text-xs text-muted-foreground">{t("chat.changes.loading")}</p>}
        {data && !data.complete && <p className="px-4 py-2 text-xs text-muted-foreground">{t("chat.changes.partial")}</p>}
        {data?.state === "finished" && data.complete && !data.canUndo && data.files.length > 0 && <p className="px-4 py-2 text-xs text-muted-foreground">{undoReasonLabel(t, data.undoReason)}</p>}
        {error && <div className="p-3"><Alert variant="destructive"><AlertDescription>{error}<Button variant="outline" size="sm" onClick={() => setRevision(value => value + 1)}>{t("chat.changes.retry")}</Button></AlertDescription></Alert></div>}
      </CardContent>
    </Card>

  </>;
}

/** Rendered only inside the existing document preview Sheet. */
export function TurnChangesPreviewPanel({ preview }: { preview: TurnChangesPreview }) {
  const t = useT();
  const [data, setData] = useState<TurnChangeSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getTurnChanges({ id: preview.id, threadId: preview.threadId }).then(result => { if (!cancelled) { setData(result); setError(null); } }).catch(err => { if (!cancelled) setError(errorLabel(t, err)); });
    return () => { cancelled = true; };
  }, [preview.id, preview.threadId, t]);
  if (error) return <p role="alert" className="p-4 text-sm text-destructive">{error}</p>;
  if (!data) return <p role="status" className="p-4 text-sm text-muted-foreground">{t("chat.changes.loading")}</p>;
  const selected = data.files.find(file => file.path === preview.path) ?? data.files[0];
  return <div className="flex h-full min-h-0 flex-col">
    <nav aria-label={t("chat.changes.files")} className="flex shrink-0 gap-1 overflow-x-auto border-b p-2">
      {data.files.map(file => <Button key={file.path} variant={selected?.path === file.path ? "secondary" : "ghost"} size="sm" title={file.path} aria-pressed={selected?.path === file.path} className="max-w-64 shrink-0" onClick={() => useDocumentPreviewStore.getState().openTurnChangesPreview({ ...preview, path: file.path }, t("chat.changes.view"))}><span className="truncate">{file.path}</span></Button>)}
    </nav>
    {selected && <TurnFileDiff key={selected.path} changeRef={preview} file={selected} />}
  </div>;
}

function TurnFileDiff({ changeRef, file }: { changeRef: TurnChangeRef; file: TurnChangedFile }) {
  const { id, threadId } = changeRef;
  const t = useT();
  const [value, setValue] = useState<{ diff: string; binary: boolean; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getTurnFileDiff({ id, threadId }, file.path).then(result => { if (!cancelled) setValue(result); }).catch(err => { if (!cancelled) setError(errorLabel(t, err)); });
    return () => { cancelled = true; };
  }, [id, threadId, file.path, t]);
  if (error) return <p role="alert" className="p-4 text-sm text-destructive">{error}</p>;
  if (!value) return <p role="status" className="p-4 text-sm text-muted-foreground">{t("chat.changes.loading")}</p>;
  if (value.binary) return <p className="p-4 text-sm text-muted-foreground">{t("chat.changes.binaryHelp")}</p>;
  return <div className="min-h-0 flex-1 overflow-auto">{value.truncated && <p className="p-3 text-xs text-muted-foreground">{t("chat.changes.diffTruncated")}</p>}<DiffViewer file={{ path: file.path, filename: file.path.split("/").at(-1) ?? file.path, status: file.status, additions: file.additions ?? 0, deletions: file.deletions ?? 0, diff: value.diff }} /></div>;
}
