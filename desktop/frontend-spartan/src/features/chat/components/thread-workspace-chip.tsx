import { useT } from "@/i18n";
import { Folder01Icon, FolderAddIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/lib/toast";
import {
  type ThreadWorkspaceBinding,
  type WorkspaceAccess,
  bindThreadWorkspace,
  unbindThreadWorkspace,
} from "../api/chat-api";
import {
  chooseProjectWorkspaceFolder,
  ensureFolderProject,
  useChatProjects,
} from "../hooks/use-chat-projects";
import { workspacePathKey } from "../utils/workspace-path-key";
import { useChatRuntimeStore } from "../stores/chat-runtime-store";
import {
  type PendingWorkspace,
  ensureThreadWorkspace,
  getPendingWorkspace,
  setPendingWorkspace,
} from "../utils/pending-workspace";
import { isAssistantLocalThreadId } from "../utils/thread-ids";

type NativeWorkspaceBridge = {
  setWorkspaceBinding?: (
    bindingId: string,
    root: string,
    access: WorkspaceAccess,
  ) => Promise<{ success: boolean; error?: string }>;
  clearWorkspaceBinding?: (
    bindingId: string,
  ) => Promise<{ success: boolean; error?: string }>;
};

function label(path: string): string {
  return (
    path
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || path
  );
}

/** The visible workspace capability for the currently open chat. */
export function ThreadWorkspaceChip({
  isRunning = false,
}: { isRunning?: boolean }) {
  const t = useT();
  const threadId = useChatRuntimeStore((state) => state.activeThreadId);
  const { projects, isLoading, error, retry } = useChatProjects();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const [binding, setBinding] = useState<ThreadWorkspaceBinding | null>(null);
  const [pending, setPending] = useState<PendingWorkspace | null>(
    getPendingWorkspace,
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedAccess, setSelectedAccess] = useState<WorkspaceAccess>("read");

  useEffect(() => {
    const refresh = () => {
      setPending(getPendingWorkspace());
      setRevision((value) => value + 1);
    };
    window.addEventListener("sparta:workspace-changed", refresh);
    return () =>
      window.removeEventListener("sparta:workspace-changed", refresh);
  }, []);

  useEffect(() => {
    setOpen(false);
    setSelectedFolder(null);
  }, [threadId]);

  useEffect(() => {
    if (isRunning) setOpen(false);
  }, [isRunning]);

  useEffect(() => {
    const form = barRef.current?.closest("form");
    const close = () => setOpen(false);
    form?.addEventListener("submit", close);
    return () => form?.removeEventListener("submit", close);
  }, []);

  useEffect(() => {
    if (!threadId || isAssistantLocalThreadId(threadId)) {
      setBinding(null);
      return;
    }
    let cancelled = false;
    void ensureThreadWorkspace(threadId)
      .then(async (next) => {
        if (cancelled) {
          return;
        }
        if (!next) {
          setBinding(null);
          return;
        }
        setBinding(next);
        setPending(null);
        if (next.projectId)
          useChatRuntimeStore.getState().setActiveProjectId(next.projectId);
        const bridge = (window as Window & { fs?: NativeWorkspaceBridge }).fs;
        const configured = await bridge?.setWorkspaceBinding?.(
          next.bindingId,
          next.canonicalPath,
          next.access,
        );
        if (configured && !configured.success) {
          throw new Error(configured.error);
        }
        if (cancelled) {
          return;
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        toast.error(t("chat.workspace.errorPrepare"), {
          description: error instanceof Error ? error.message : undefined,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, t, revision]);

  async function selectFolder() {
    setOpen(false);
    try {
      const folder = await chooseProjectWorkspaceFolder();
      if (!folder) {
        return;
      }
      const previousPath = binding?.canonicalPath ?? pending?.folder;
      const previousAccess = binding?.access ?? pending?.access;
      if (previousPath === folder && previousAccess) {
        await confirmFolderAccess(folder, previousAccess);
        return;
      }
      // Full access was explicitly confirmed in the permission selector.
      // It applies only to this newly selected root, never to other folders.
      if (
        !previousPath &&
        useChatRuntimeStore.getState().permissionMode === "full"
      ) {
        await confirmFolderAccess(folder, "write");
        return;
      }
      setSelectedAccess("read");
      setSelectedFolder(folder);
    } catch (error) {
      toast.error(t("chat.workspace.errorSelect"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function confirmFolderAccess(
    folderOverride?: string,
    accessOverride?: WorkspaceAccess,
  ) {
    if (!(folderOverride ?? selectedFolder)) {
      return;
    }
    const folder = (folderOverride ?? selectedFolder)!;
    const access = accessOverride ?? selectedAccess;
    setBusy(true);
    try {
      const activeThreadId = threadId;
      if (!activeThreadId || isAssistantLocalThreadId(activeThreadId)) {
        if (!useChatRuntimeStore.getState().incognito) {
          const project = await ensureFolderProject(folder);
          useChatRuntimeStore.getState().setActiveProjectId(project.id);
        }
        setPendingWorkspace({ folder, access });
        setPending({ folder, access });
        setSelectedFolder(null);
        return;
      }
      const next = await bindThreadWorkspace(activeThreadId, folder, access);
      const bridge = (window as Window & { fs?: NativeWorkspaceBridge }).fs;
      const configured = await bridge?.setWorkspaceBinding?.(
        next.bindingId,
        next.canonicalPath,
        next.access,
      );
      if (configured && !configured.success) {
        throw new Error(configured.error);
      }
      setBinding(next);
      if (next.projectId)
        useChatRuntimeStore.getState().setActiveProjectId(next.projectId);
      window.dispatchEvent(new Event("sparta:workspace-changed"));
      setSelectedFolder(null);
    } catch (error) {
      toast.error(t("chat.workspace.errorConnect"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setOpen(false);
    setPendingWorkspace(null);
    setPending(null);
    if (!threadId || isAssistantLocalThreadId(threadId) || !binding) {
      setBinding(null);
      window.dispatchEvent(new Event("sparta:workspace-changed"));
      return;
    }
    setBusy(true);
    try {
      await unbindThreadWorkspace(threadId);
      const bridge = (window as Window & { fs?: NativeWorkspaceBridge }).fs;
      await bridge?.clearWorkspaceBinding?.(binding.bindingId);
      setBinding(null);
      window.dispatchEvent(new Event("sparta:workspace-changed"));
    } catch (error) {
      toast.error(t("chat.workspace.errorDisconnect"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  const visibleBinding = binding?.threadId === threadId ? binding : null;
  const currentPath = visibleBinding?.canonicalPath ?? pending?.folder;
  const currentAccess = visibleBinding?.access ?? pending?.access;

  const chip = (
    <button
      type="button"
      disabled={busy || isRunning}
      className="composer-pill-btn composer-pill-workspace"
      data-keep-label="true"
      aria-label={
        currentPath ? label(currentPath) : t("chat.workspace.chipLabel")
      }
      title={currentPath ?? t("chat.workspace.chipLabel")}
    >
      <span className="composer-pill-glyph">
        <HugeiconsIcon
          icon={visibleBinding || pending ? Folder01Icon : FolderAddIcon}
          className="size-3.5"
          strokeWidth={1.8}
        />
      </span>
      <span className="max-w-48 truncate">
        {currentPath ? label(currentPath) : t("chat.workspace.chipLabel")}
      </span>
      <ChevronDownIcon className="size-3 shrink-0" />
    </button>
  );

  const accessDialog = (
    <Dialog
      open={selectedFolder !== null}
      onOpenChange={(open) => !open && setSelectedFolder(null)}
    >
      <DialogContent className="max-w-lg" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>{t("chat.workspace.connectTitle")}</DialogTitle>
          <DialogDescription>
            {t("chat.workspace.connectDescription")}
          </DialogDescription>
        </DialogHeader>
        <p className="break-all rounded-2xl bg-muted px-4 py-3 text-sm text-foreground">
          {selectedFolder}
        </p>
        <RadioGroup
          value={selectedAccess}
          onValueChange={(value) => setSelectedAccess(value as WorkspaceAccess)}
          aria-label={t("chat.workspace.permissionAria")}
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border px-4 py-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem
              value="read"
              aria-label={t("chat.workspace.readOnly")}
            />
            <span className="flex flex-col gap-1">
              <span className="font-medium">
                {t("chat.workspace.readOnly")}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("chat.workspace.readOnlyDesc")}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border px-4 py-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem
              value="write_no_delete"
              aria-label={t("chat.workspace.editNoDelete")}
            />
            <span className="flex flex-col gap-1">
              <span className="font-medium">
                {t("chat.workspace.editNoDelete")}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("chat.workspace.editNoDeleteDesc")}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border px-4 py-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem
              value="write"
              aria-label={t("chat.workspace.allowEdits")}
            />
            <span className="flex flex-col gap-1">
              <span className="font-medium">
                {t("chat.workspace.allowEdits")}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("chat.workspace.allowEditsDesc")}
              </span>
            </span>
          </label>
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedFolder(null)}>
            {t("chat.workspace.cancel")}
          </Button>
          <Button disabled={busy} onClick={() => void confirmFolderAccess()}>
            {t("chat.workspace.connect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <div
        ref={barRef}
        className="composer-workspace-bar"
        aria-label={t("chat.workspace.contextLabel")}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild={true}>{chip}</PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-80 max-w-[calc(100vw-2rem)] p-0"
          >
            <Command>
              <CommandInput placeholder={t("chat.workspace.searchFolders")} />
              <CommandList>
                <CommandEmpty>
                  {isLoading
                    ? t("chat.workspace.loading")
                    : t("chat.workspace.noFolders")}
                </CommandEmpty>
                <CommandGroup heading={t("chat.workspace.recentFolders")}>
                  {projects
                    .filter((project) => project.connectedFolderPath)
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map((project) => {
                      const folder = project.connectedFolderPath!;
                      const selected = Boolean(
                        currentPath &&
                          workspacePathKey(currentPath) ===
                            workspacePathKey(folder),
                      );
                      return (
                        <CommandItem
                          key={project.id}
                          value={project.id}
                          keywords={[project.name, folder]}
                          disabled={busy}
                          onSelect={() => {
                            setOpen(false);
                            if (selected) return;
                            setSelectedAccess("read");
                            setSelectedFolder(folder);
                          }}
                        >
                          <HugeiconsIcon
                            icon={Folder01Icon}
                            strokeWidth={1.8}
                          />
                          <span
                            className="min-w-0 flex-1 truncate"
                            title={folder}
                          >
                            {project.name}
                          </span>
                          {selected ? (
                            <CheckIcon
                              aria-label={t("chat.workspace.selected")}
                            />
                          ) : null}
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  {error ? (
                    <CommandItem onSelect={retry}>
                      {t("chat.workspace.retryFolders")}
                    </CommandItem>
                  ) : null}
                  <CommandItem
                    disabled={busy}
                    onSelect={() => void selectFolder()}
                  >
                    <HugeiconsIcon icon={FolderAddIcon} strokeWidth={1.8} />
                    {t("chat.workspace.connect")}
                  </CommandItem>
                  {currentPath ? (
                    <CommandItem
                      disabled={busy}
                      onSelect={() => void disconnect()}
                    >
                      <XIcon />
                      {t("chat.workspace.withoutFolder")}
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {currentAccess ? (
          <span className="composer-workspace-access" title={currentPath}>
            {busy
              ? t("chat.workspace.loading")
              : currentAccess === "read"
                ? t("chat.workspace.readOnly")
                : currentAccess === "write_no_delete"
                  ? t("chat.workspace.editNoDelete")
                  : t("chat.workspace.allowEdits")}
          </span>
        ) : null}
      </div>
      {accessDialog}
    </>
  );
}
