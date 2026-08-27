
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ProjectSourceDropzone,
  type StagedSource,
  uploadStagedSources,
} from "@/features/rag/components/project-source-dropzone";
import { toast } from "@/lib/toast";
import { Folder02Icon, FolderAddIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useT } from "@/i18n";

import {
  chooseProjectWorkspaceFolder,
  createChatProject,
  setChatProjectWorkspace,
} from "../hooks/use-chat-projects";
import { useChatRuntimeStore } from "../stores/chat-runtime-store";
import type { ProjectRecord } from "../types";

function currentRoute(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search;
}

// Create-project dialog for the composer, sidebar, and projects page. Creating
// opens the new project; `onCreated` overrides that for callers with their own
// follow-up (the sidebar's "move this chat to a new project").
export function NewProjectDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  submitLabel?: string;
  onCreated?: (
    project: ProjectRecord,
    context: { stayedOnRoute: boolean },
  ) => void | Promise<void>;
}) {
  const t = useT();
  const navigate = useNavigate();
  const resolvedTitle = title ?? t("projectsPage.createProjectTitle");
  const resolvedSubmitLabel = submitLabel ?? t("projectsPage.createProjectTitle");
  const [name, setName] = useState("");
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedSource[]>([]);
  const [busy, setBusy] = useState(false);
  // A desktop drop reaches `staged` only once its native registration settles.
  // Creating before then would upload without the files the user just dropped.
  const [stagingDrop, setStagingDrop] = useState(false);
  // Uploads outlive this component, so a slow one must not yank the user to the
  // new project after they have navigated away.
  const mounted = useRef(true);
  useEffect(() => {
    // Set on setup, not just cleared on cleanup: StrictMode replays
    // setup/cleanup/setup, which would otherwise leave this false forever.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function reset() {
    setName("");
    setWorkspacePath(null);
    setStaged([]);
    setStagingDrop(false);
  }

  // Every close path routes through here: callers keep this mounted, so a draft
  // left behind would resurface (and upload) on the next project.
  function close() {
    if (busy) return;
    reset();
    onOpenChange(false);
  }

  async function commitCreate() {
    const trimmed = name.trim();
    if (!trimmed || busy || stagingDrop) return;
    setBusy(true);
    // Sidebar callers keep this mounted across routes, so unmounting alone
    // cannot tell whether the user has moved on during a slow upload.
    const origin = currentRoute();
    try {
      const project = await createChatProject(trimmed);
      if (workspacePath) {
        await setChatProjectWorkspace(project.id, workspacePath);
      }
      // Upload before closing so the Sources panel lists them on first fetch.
      await uploadStagedSources(project.id, staged);
      if (!mounted.current) return;
      const stayedOnRoute = currentRoute() === origin;
      onOpenChange(false);
      reset();
      if (onCreated) {
        await onCreated(project, { stayedOnRoute });
        return;
      }
      if (!stayedOnRoute) return;
      const runtime = useChatRuntimeStore.getState();
      runtime.setActiveThreadId(null);
      runtime.setActiveProjectId(project.id);
      navigate({ to: "/chat", search: { project: project.id } });
    } catch (err) {
      toast.error(t("projectsPage.failedToCreateProject"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function chooseWorkspace() {
    if (busy) return;
    try {
      const folder = await chooseProjectWorkspaceFolder();
      if (folder) setWorkspacePath(folder);
    } catch (err) {
      toast.error(t("projectsPage.failedToUpdateFolder"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        close();
      }}
    >
      <DialogContent className="corner-squircle dialog-soft-surface grid-cols-[minmax(0,1fr)] gap-4 overflow-x-hidden [&>*]:min-w-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-ui-21">{resolvedTitle}</DialogTitle>
        </DialogHeader>
        {/* Name field: folder glyph in its own cell, divided from the input. */}
        <div className="flex items-stretch overflow-hidden rounded-[16px] border border-border bg-background transition-colors focus-within:border-ring has-[input:disabled]:opacity-50 dark:border-transparent dark:bg-white/[0.06]">
          <span className="flex w-9 shrink-0 items-center justify-center text-muted-foreground">
            <HugeiconsIcon
              icon={Folder02Icon}
              strokeWidth={1.75}
              className="size-5"
            />
          </span>
          <span aria-hidden="true" className="my-3 w-px bg-border" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitCreate();
              }
            }}
            autoFocus={true}
            disabled={busy}
            maxLength={120}
            placeholder={t("projectsPage.projectNamePlaceholder")}
            aria-label={t("projectsPage.projectNamePlaceholder")}
            className="min-w-0 flex-1 bg-transparent py-4 pr-4 pl-2.5 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </div>
        <div className="min-w-0 rounded-[16px] border border-border bg-background p-3 dark:border-transparent dark:bg-white/[0.06]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{t("projectsPage.workspaceTitle")}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={workspacePath ?? undefined}>
                {workspacePath ?? t("projectsPage.workspaceOptional")}
              </p>
              {workspacePath && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("projectsPage.workspaceSavedWithProject")}
                </p>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void chooseWorkspace()}>
              <HugeiconsIcon data-icon="inline-start" icon={FolderAddIcon} strokeWidth={1.75} />
              {workspacePath ? t("projectsPage.changeFolder") : t("projectsPage.connectFolder")}
            </Button>
          </div>
        </div>
        <ProjectSourceDropzone
          staged={staged}
          onChange={setStaged}
          disabled={busy}
          onPendingChange={setStagingDrop}
        />
        <DialogFooter className="flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="ghost" disabled={busy} onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void commitCreate()}
            disabled={!name.trim() || busy || stagingDrop}
          >
            {busy ? t("projectsPage.creating") : stagingDrop ? t("projectsPage.addingSources") : resolvedSubmitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
