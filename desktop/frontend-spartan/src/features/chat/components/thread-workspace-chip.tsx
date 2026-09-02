import { FolderAddIcon, Folder01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";

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
  getThreadWorkspace,
  unbindThreadWorkspace,
  type ThreadWorkspaceBinding,
  type WorkspaceAccess,
} from "../api/chat-api";
import {
  chooseProjectWorkspaceFolder,
} from "../hooks/use-chat-projects";
import { useChatRuntimeStore } from "../stores/chat-runtime-store";
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

type PendingWorkspace = { folder: string; access: WorkspaceAccess };
let pendingWorkspace: PendingWorkspace | null = null;

function label(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
}

/** The visible workspace capability for the currently open chat. */
export function ThreadWorkspaceChip() {
  const threadId = useChatRuntimeStore((state) => state.activeThreadId);
  const [binding, setBinding] = useState<ThreadWorkspaceBinding | null>(null);
  const [pending, setPending] = useState<PendingWorkspace | null>(pendingWorkspace);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedAccess, setSelectedAccess] = useState<WorkspaceAccess>("read");

  useEffect(() => {
    if (!threadId || isAssistantLocalThreadId(threadId)) {
      setBinding(null);
      return;
    }
    void getThreadWorkspace(threadId)
      .then(async (next) => {
        if (!next) {
          setBinding(null);
          return;
        }
        const bridge = (window as Window & { fs?: NativeWorkspaceBridge }).fs;
        const configured = await bridge?.setWorkspaceBinding?.(
          next.bindingId,
          next.canonicalPath,
          next.access,
        );
        if (configured && !configured.success) throw new Error(configured.error);
        setBinding(next);
      })
      .catch(() => setBinding(null));
  }, [threadId]);

  useEffect(() => {
    if (!threadId || isAssistantLocalThreadId(threadId) || !pendingWorkspace) return;
    const staged = pendingWorkspace;
    void (async () => {
      try {
        const next = await bindThreadWorkspace(threadId, staged.folder, staged.access);
        const bridge = (window as Window & { fs?: NativeWorkspaceBridge }).fs;
        const configured = await bridge?.setWorkspaceBinding?.(next.bindingId, next.canonicalPath, next.access);
        if (configured && !configured.success) throw new Error(configured.error);
        if (pendingWorkspace === staged) pendingWorkspace = null;
        setPending(null);
        setBinding(next);
      } catch (error) {
        toast.error("No se pudo preparar la carpeta de trabajo", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    })();
  }, [threadId]);

  async function selectFolder() {
    try {
      const folder = await chooseProjectWorkspaceFolder();
      if (!folder) return;
      setSelectedAccess("read");
      setSelectedFolder(folder);
    } catch (error) {
      toast.error("No se pudo seleccionar la carpeta de trabajo", {
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
        pendingWorkspace = { folder, access };
        setPending(pendingWorkspace);
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
      toast.error("No se pudo conectar la carpeta de trabajo", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function disconnect() {
    pendingWorkspace = null;
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
      toast.error("No se pudo desconectar la carpeta de trabajo", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  const currentPath = binding?.canonicalPath ?? pending?.folder;
  const currentAccess = binding?.access ?? pending?.access;

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
          className="size-[15px]"
          strokeWidth={1.8}
        />
      </span>
      <span className="whitespace-nowrap">
        {currentPath ? label(currentPath) : "Trabajar en una carpeta"}
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
          <DialogTitle>Conectar carpeta de trabajo</DialogTitle>
          <DialogDescription>
            Elige qué puede hacer Sparta Agent dentro de esta carpeta. Este acceso solo pertenece a este chat.
          </DialogDescription>
        </DialogHeader>
        <p className="break-all rounded-2xl bg-muted px-4 py-3 text-sm text-foreground">
          {selectedFolder}
        </p>
        <RadioGroup
          value={selectedAccess}
          onValueChange={(value) => setSelectedAccess(value as WorkspaceAccess)}
          aria-label="Permiso de carpeta"
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border px-4 py-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem value="read" aria-label="Solo lectura" />
            <span className="flex flex-col gap-1">
              <span className="font-medium">Solo lectura</span>
              <span className="text-sm text-muted-foreground">Puede revisar archivos, pero no modificarlos.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border px-4 py-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem value="write_no_delete" aria-label="Editar sin eliminar" />
            <span className="flex flex-col gap-1">
              <span className="font-medium">Editar sin eliminar</span>
              <span className="text-sm text-muted-foreground">Puede crear y editar; no puede borrar archivos.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border px-4 py-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem value="write" aria-label="Permitir ediciones" />
            <span className="flex flex-col gap-1">
              <span className="font-medium">Permitir ediciones</span>
              <span className="text-sm text-muted-foreground">Puede crear, editar y eliminar archivos cuando se lo pidas.</span>
            </span>
          </label>
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedFolder(null)}>Cancelar</Button>
          <Button onClick={() => void confirmFolderAccess()}>Conectar carpeta</Button>
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
            Cambiar carpeta
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void disconnect()}>
            Desconectar carpeta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {accessDialog}
    </>
  );
}
