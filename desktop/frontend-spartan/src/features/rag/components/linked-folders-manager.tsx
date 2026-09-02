
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { FolderSyncIcon, MoreHorizontalIcon, RotateCwIcon } from "lucide-react";
import { useState } from "react";
import type { FolderSyncJob, LinkedFolderScope } from "../types/rag";
import { useLinkedFolders } from "./use-linked-folders";

function percent(progress?: number | null): number | null {
  if (progress == null || !Number.isFinite(progress)) return null;
  return Math.max(0, Math.min(100, progress <= 1 ? progress * 100 : progress));
}

function jobSummary(job: FolderSyncJob, t: ReturnType<typeof useT>): string {
  if (job.status === "failed") return job.error ?? t("projectsPage.syncFailed");
  if (job.status === "completed") {
    const indexed = job.indexedFiles ?? job.processedFiles;
    return indexed == null
      ? t("projectsPage.syncComplete")
      : t("projectsPage.filesIndexed", { count: indexed });
  }
  const processed = job.processedFiles ?? 0;
  const discovered = job.discoveredFiles;
  return discovered == null
    ? job.stage || t("projectsPage.scanningFolder")
    : t("projectsPage.filesProcessed", { processed, total: discovered });
}

export function LinkedFoldersManager({
  scope,
  compact = false,
  onSourcesChanged,
}: {
  scope?: LinkedFolderScope;
  compact?: boolean;
  onSourcesChanged?: () => void;
}) {
  const t = useT();
  const manager = useLinkedFolders(scope, onSourcesChanged);
  const [removeIndexFolder, setRemoveIndexFolder] = useState<{
    id: string;
    name: string;
  } | null>(null);

  return (
    <section className={cn("flex min-w-0 flex-col gap-3", compact && "gap-2")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">
            {t("projectsPage.linkedFoldersTitle")}
          </h3>
          <p className="text-xs leading-snug text-muted-foreground">
            {manager.desktopSupported
              ? t("projectsPage.linkedFoldersDescription")
              : t("projectsPage.linkedFoldersDesktopDescription")}
          </p>
        </div>
        {scope ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={!manager.desktopSupported || manager.mutating}
            onClick={() => void manager.link()}
            title={
              manager.desktopSupported
                ? t("projectsPage.chooseLocalFolder")
                : t("projectsPage.desktopBackendRequired")
            }
          >
            {manager.mutating ? (
              <Spinner className="size-3.5" />
            ) : (
              <FolderSyncIcon className="size-3.5" />
            )}
            {t("projectsPage.linkFolder")}
          </Button>
        ) : null}
      </div>

      {manager.loading && manager.folders.length === 0 ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : manager.folders.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">
          {t("projectsPage.noLinkedFolders")}
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {manager.folders.map((folder) => {
            const job = manager.jobs[folder.id];
            const running =
              job?.status === "pending" || job?.status === "running";
            const progress = percent(job?.progress);
            return (
              <li
                key={folder.id}
                className="flex min-w-0 items-start gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5"
              >
                <FolderSyncIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="truncate text-sm font-medium"
                      title={folder.displayName}
                    >
                      {folder.displayName}
                    </span>
                    {scope ? null : (
                      <span
                        className="max-w-48 shrink truncate text-ui-11 text-muted-foreground"
                        title={
                          folder.scopeName ||
                          `${folder.scopeType === "knowledge_base" ? "Knowledge base" : "Project"} ${folder.scopeId}`
                        }
                      >
                        {folder.scopeName ||
                          `${folder.scopeType === "knowledge_base" ? "Knowledge base" : "Project"} ${folder.scopeId}`}
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-ui-11 text-muted-foreground",
                      (folder.status === "error" || job?.status === "failed") &&
                        "text-destructive",
                    )}
                  >
                    {job
                      ? jobSummary(job, t)
                      : folder.error ||
                        (folder.lastSyncedAt
                          ? t("projectsPage.lastSynced", { date: new Date(folder.lastSyncedAt).toLocaleString() })
                          : t("projectsPage.indexedDocuments", { count: folder.documentCount ?? 0 }))}
                  </p>
                  {running ? (
                    <Progress
                      value={progress ?? 0}
                      aria-label={t("projectsPage.syncProgress", { name: folder.displayName })}
                      className="mt-2 h-1.5"
                    />
                  ) : null}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild={true}>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="shrink-0 rounded-full"
                      aria-label={t("projectsPage.folderActions", { name: folder.displayName })}
                    >
                      {running ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <MoreHorizontalIcon className="size-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={running}
                      onSelect={() => void manager.sync(folder.id)}
                    >
                      <FolderSyncIcon className="size-3.5" /> {t("projectsPage.syncChanges")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={running}
                      onSelect={() => void manager.rebuild(folder.id)}
                    >
                      <RotateCwIcon className="size-3.5" /> {t("projectsPage.rebuildIndex")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => void manager.remove(folder.id, false)}
                    >
                      {t("projectsPage.unlinkKeepFiles")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        setRemoveIndexFolder({
                          id: folder.id,
                          name: folder.displayName,
                        })
                      }
                    >
                      {t("projectsPage.unlinkRemoveFiles")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}
      <AlertDialog
        open={removeIndexFolder !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveIndexFolder(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("projectsPage.unlinkRemoveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("projectsPage.unlinkRemoveDescription", { name: removeIndexFolder?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const folder = removeIndexFolder;
                setRemoveIndexFolder(null);
                if (folder) void manager.remove(folder.id, true);
              }}
            >
              {t("projectsPage.unlinkRemoveAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
