import { FolderAddIcon, Folder01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";

import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  bindThreadWorkspace,
  unbindThreadWorkspace,
  type ThreadWorkspaceBinding,
  type WorkspaceAccess,
} from "../api/chat-api";
import {
  chooseProjectWorkspaceFolder,
} from "../hooks/use-chat-projects";
import { useChatRuntimeStore } from "../stores/chat-runtime-store";
import { isAssistantLocalThreadId } from "../utils/thread-ids";
import { ensureThreadWorkspace, getPendingWorkspace, setPendingWorkspace, type PendingWorkspace } from "../utils/pending-workspace";

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
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
}

/** The visible workspace capability for the currently open chat. */
export function ThreadWorkspaceChip() {
  const t = useT();
  const threadId = useChatRuntimeStore((state) => state.activeThreadId);
  const [binding, setBinding] = useState<ThreadWorkspaceBinding | null>(null);
  const [pending, setPending] = useState<PendingWorkspace | null>(getPendingWorkspace);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedAccess, setSelectedAccess] = useState<WorkspaceAccess>("read");

  useEffect(() => {
    if (!threadId || isAssistantLocalThreadId(threadId)) {
      setBinding(null);
      return;
    }
    let cancelled = false;
    void ensureThreadWorkspace(threadId)
      .then(async (next) => {
        if (cancelled) return;
        if (!next) {
          setBinding(null);
          return;
        }
        setBinding(next);
        setPending(null);
        const bridge = (window as Window & { fs?: NativeWorkspaceBridge }).fs;
        const configured = await bridge?.setWorkspaceBinding?.(
          next.bindingId,
          next.canonicalPath,
          next.access,
        );
        if (configured && !configured.success) throw new Error(configured.error);
        if (cancelled) return;
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(t("chat.workspace.errorPrepare"), {
          description: error instanceof Error ? error.message : undefined,
        });
      });
    return () => { cancelled = true; };
  }, [threadId, t]);

  async function selectFolder() {
    try {
      const folder = await chooseProjectWorkspaceFolder();
      if (!folder) return;
      setSelectedAccess("read");
      setSelectedFolder(folder);
    } catch (error) {
      toast.error(t("chat.workspace.errorSelect"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function confirmFolderAccess() {
    if (!selectedFolder) return;
    const folder = selectedFolder;
    const access = selectedAccess;
    try {
      const activeThreadId = threadId;
      if (!activeThreadId || isAssistantLocalThreadId(activeThreadId)) {
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
      if (configured && !configured.success) throw new Error(configured.error);
      setBinding(next);
      setSelectedFolder(null);
    } catch (error) {
      toast.error(t("chat.workspace.errorConnect"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function disconnect() {
    setPendingWorkspace(null);
    setPending(null);
    if (!threadId || isAssistantLocalThreadId(threadId) || !binding) {
      setBinding(null);
      return;
    }
    try {
      await unbindThreadWorkspace(threadId);
      const bridge = (window as Window & { fs?: NativeWorkspaceBridge }).fs;
      await bridge?.clearWorkspaceBinding?.(binding.bindingId);
      setBinding(null);
    } catch (error) {
      toast.error(t("chat.workspace.errorDisconnect"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  const visibleBinding = binding?.threadId === threadId ? binding : null;
  const currentPath = visibleBinding?.canonicalPath ?? pending?.folder;
  const currentAccess = visibleBinding?.access ?? pending?.access;

  const chip = (
    <button
      type="button"
      onClick={() => {
        if (!binding && !pending) void selectFolder();
      }}
      className="composer-pill-btn"
      data-keep-label="true"
      title={currentPath}
    >
      <span className="composer-pill-glyph">
        <HugeiconsIcon
          icon={binding || pending ? Folder01Icon : FolderAddIcon}
          className="size-3.5"
          strokeWidth={1.8}
        />
      </span>
      <span className="whitespace-nowrap">
        {currentPath ? label(currentPath) : t("chat.workspace.chipLabel")}
      </span>
      {currentAccess ? (
        <span className="text-[10px] uppercase text-muted-foreground">
          {currentAccess === "read"
            ? "RO"
            : currentAccess === "write_no_delete"
              ? "RW-"
              : "RW"}
        </span>
      ) : null}
    </button>
  );

  const accessDialog = (
    <Dialog
      open={selectedFolder !== null}
      onOpenChange={(open) => !open && setSelectedFolder(null)}
    >
      <DialogContent className="max-w-lg" showCloseButton>
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
            <RadioGroupItem value="read" aria-label={t("chat.workspace.readOnly")} />
            <span className="flex flex-col gap-1">
              <span className="font-medium">{t("chat.workspace.readOnly")}</span>
              <span className="text-sm text-muted-foreground">{t("chat.workspace.readOnlyDesc")}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border px-4 py-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem value="write_no_delete" aria-label={t("chat.workspace.editNoDelete")} />
            <span className="flex flex-col gap-1">
              <span className="font-medium">{t("chat.workspace.editNoDelete")}</span>
              <span className="text-sm text-muted-foreground">{t("chat.workspace.editNoDeleteDesc")}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border px-4 py-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem value="write" aria-label={t("chat.workspace.allowEdits")} />
            <span className="flex flex-col gap-1">
              <span className="font-medium">{t("chat.workspace.allowEdits")}</span>
              <span className="text-sm text-muted-foreground">{t("chat.workspace.allowEditsDesc")}</span>
            </span>
          </label>
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedFolder(null)}>{t("chat.workspace.cancel")}</Button>
          <Button onClick={() => void confirmFolderAccess()}>{t("chat.workspace.connect")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!binding && !pending) return <>{chip}{accessDialog}</>;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{chip}</DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64">
          <DropdownMenuItem disabled className="truncate">
            {currentPath}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void selectFolder()}>
            {t("chat.workspace.changeFolder")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void disconnect()}>
            {t("chat.workspace.disconnectFolder")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {accessDialog}
    </>
  );
}
