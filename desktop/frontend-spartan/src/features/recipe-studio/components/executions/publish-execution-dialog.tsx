import { translate as uiTranslate } from "@/i18n";
import { useT as useUiT } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toastError, toastSuccess } from "@/shared/toast";
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Key01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import type { RecipeExecutionRecord } from "../../execution-types";
import { copyTextToClipboard } from "../../executions/execution-helpers";

type PublishExecutionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  execution: RecipeExecutionRecord | null;
  onPublish: (payload: {
    repo_id: string;
    description: string;
    hf_token?: string | null;
    private: boolean;
    artifact_path?: string | null;
  }) => Promise<{ url: string }>;
};

function getExecutionRecordCount(
  execution: RecipeExecutionRecord | null,
): number | null {
  if (!execution) {
    return null;
  }
  if (typeof execution.analysis?.num_records === "number") {
    return execution.analysis.num_records;
  }
  if (execution.datasetTotal > 0) {
    return execution.datasetTotal;
  }
  if (execution.rows > 0) {
    return execution.rows;
  }
  return null;
}

function buildDefaultDescription(
  execution: RecipeExecutionRecord | null,
): string {
  if (!execution) {
    return "";
  }
  const runName = execution.run_name?.trim() || "This dataset";
  const records = getExecutionRecordCount(execution);
  const recordPart =
    typeof records === "number" && records > 0
      ? ` It contains ${records.toLocaleString()} generated records.`
      : "";
  return `${runName} was generated with Unsloth Recipe Studio.${recordPart}`;
}

export function PublishExecutionDialog({
  open,
  onOpenChange,
  execution,
  onPublish,
}: PublishExecutionDialogProps): ReactElement {
  const uiT = useUiT();

  const [repoId, setRepoId] = useState("");
  const [description, setDescription] = useState("");
  const [hfToken, setHfToken] = useState("");
  const [privateRepo, setPrivateRepo] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const defaultDescription = useMemo(
    () => buildDefaultDescription(execution),
    [execution],
  );
  const runLabel = execution?.run_name?.trim() || "Completed run";
  const recordCount = getExecutionRecordCount(execution);
  const recordLabel =
    typeof recordCount === "number" ? recordCount.toLocaleString() : "--";

  useEffect(() => {
    if (!open) {
      setPublishing(false);
      setPublishError(null);
      setPublishedUrl(null);
      setRepoId("");
      setDescription("");
      setHfToken("");
      setPrivateRepo(false);
      return;
    }
    setPublishError(null);
    setPublishedUrl(null);
    setDescription(buildDefaultDescription(execution));
  }, [execution, open]);

  const canSubmit =
    !publishing &&
    Boolean(execution?.jobId) &&
    Boolean(execution?.artifact_path) &&
    repoId.trim().length > 0 &&
    description.trim().length > 0;

  const handleCopyUrl = async (): Promise<void> => {
    if (!publishedUrl) {
      return;
    }
    const ok = await copyTextToClipboard(publishedUrl);
    if (ok) {
      toastSuccess(uiTranslate("ui.dataset_link_copied"));
      return;
    }
    toastError(uiTranslate("ui.copy_failed"), "Could not copy the dataset link.");
  };

  const handlePublish = async (): Promise<void> => {
    if (!execution?.jobId) {
      setPublishError(
        "This run is missing a job id, so it cannot be published.",
      );
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await onPublish({
        repo_id: repoId.trim(),
        description: description.trim(),
        hf_token: hfToken.trim() || null,
        private: privateRepo,
        artifact_path: execution.artifact_path,
      });
      setPublishedUrl(result.url);
      toastSuccess(uiTranslate("ui.dataset_published"));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not publish this dataset.";
      setPublishError(message);
      toastError(uiTranslate("ui.publish_failed"), message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (publishing) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="sm:max-w-xl"
        overlayClassName="bg-black/55"
        onInteractOutside={(event) => {
          if (publishing) {
            event.preventDefault();
          }
        }}
      >
        {publishedUrl ? (
          <>
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="size-6 text-emerald-600 dark:text-emerald-400"
                />
              </div>
              <div className="space-y-1 text-center">
                <DialogTitle>{uiT("ui.published")}</DialogTitle>
                <DialogDescription>
                  {uiT("ui.your_dataset_is_live_on_hugging_face")}</DialogDescription>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/55 p-3 text-xs">
              <p className="mb-1 text-muted-foreground">{uiT("ui.dataset_url")}</p>
              <p className="break-all font-medium text-foreground">
                {publishedUrl}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCopyUrl}>
                <HugeiconsIcon icon={Copy01Icon} className="mr-2 size-4" />
                {uiT("ui.copy_link")}</Button>
              <Button asChild={true}>
                <a href={publishedUrl} target="_blank" rel="noreferrer">
                  {uiT("ui.open_repo")}<HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="ml-2 size-4"
                  />
                </a>
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {uiT("tour.done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{uiT("ui.publish_to_hugging_face")}</DialogTitle>
              <DialogDescription>
                {uiT("ui.create_or_update_a_dataset_repo_from_this_completed_run")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-card/55 p-3 text-xs">
                <p className="font-medium text-foreground">{uiT("ui.from_this_run")}</p>
                <div className="mt-2 grid gap-1.5 text-muted-foreground sm:grid-cols-2">
                  <p>
                    {uiT("ui.run")}{" "}<span className="text-foreground">{runLabel}</span>
                  </p>
                  <p>
                    {uiT("ui.records_")}{" "}
                    <span className="text-foreground">{recordLabel}</span>
                  </p>
                </div>
                <p className="mt-2 text-muted-foreground">
                  {uiT("ui.we_ll_upload_the_generated_dataset_dataset_card_images_and_any_pr")}</p>
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="publish-repo-id"
                >
                  {uiT("ui.repository")}</label>
                <Input
                  id="publish-repo-id"
                  placeholder="your-name/customer-support-synth"
                  value={repoId}
                  onChange={(event) => setRepoId(event.target.value)}
                  disabled={publishing}
                />
                <p className="text-xs text-muted-foreground">
                  {uiT("ui.use_the_format")}{" "}
                  <span className="font-mono">
                    username-or-org/dataset-name
                  </span>
                  .
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="publish-description"
                >
                  {uiT("ui.about_this_dataset")}</label>
                <Textarea
                  id="publish-description"
                  className="corner-squircle"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={publishing}
                  rows={4}
                  placeholder={
                    defaultDescription || uiT("ui.what_is_this_dataset_for")
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {uiT("ui.this_short_summary_is_used_in_the_dataset_card_on_hugging_face")}</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="publish-hf-token"
                  >
                    {uiT("ui.hf_write_token")}</label>
                  <a
                    href="https://huggingface.co/settings/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground underline underline-offset-3 hover:text-foreground"
                  >
                    {uiT("ui.manage_tokens")}</a>
                </div>
                <div className="relative">
                  <HugeiconsIcon
                    icon={Key01Icon}
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="publish-hf-token"
                    type="password"
                    autoComplete="new-password"
                    className="pl-9"
                    placeholder="hf_..."
                    value={hfToken}
                    onChange={(event) => setHfToken(event.target.value)}
                    disabled={publishing}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {uiT("ui.leave_empty_if_you_re_already_logged_in_via_cli")}</p>
              </div>

              <div className="corner-squircle flex items-start gap-3 rounded-2xl border border-border/60 bg-card/35 p-3">
                <Switch
                  id="publish-private"
                  size="sm"
                  checked={privateRepo}
                  onCheckedChange={setPrivateRepo}
                  disabled={publishing}
                />
                <div className="space-y-1">
                  <label
                    htmlFor="publish-private"
                    className="text-sm font-medium text-foreground"
                  >
                    {uiT("ui.private_dataset")}</label>
                  <p className="text-xs text-muted-foreground">
                    {uiT("ui.only_people_with_access_can_view_or_download_the_repo")}</p>
                </div>
              </div>

              {publishError ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {publishError}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={publishing}
              >
                {uiT("chat.workspace.cancel")}</Button>
              <Button
                onClick={() => void handlePublish()}
                disabled={!canSubmit}
              >
                {publishing ? uiT("ui.publishing") : uiT("ui.publish_to_hugging_face")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
