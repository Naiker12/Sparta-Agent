/**
 * Sparta Agent – Sidebar Modals & Dialogs
 *
 * Contenedor modular de los modales y diálogos de confirmación de la barra lateral:
 * - Diálogo de eliminación con switch para borrar archivos sandbox del disco
 * - Diálogo de renombrado para chats y proyectos
 * - Diálogo de creación y reubicación de proyectos (NewProjectDialog)
 */

import { useT } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NewProjectDialog } from "@/features/chat/components/new-project-dialog";
import type { ProjectRecord, SidebarItem } from "@/features/chat";
import { renderEmphasizedTranslation } from "./sidebar-types-and-constants";

export type DeleteTarget =
  | { kind: "chat"; item: SidebarItem }
  | { kind: "chats"; items: SidebarItem[] }
  | { kind: "project"; project: ProjectRecord }
  | { kind: "projects"; projects: ProjectRecord[] };

export type RenameTarget =
  | { kind: "chat"; item: SidebarItem; current: string }
  | { kind: "project"; project: ProjectRecord; current: string };

export function SidebarDialogs({
  confirmingDelete,
  onConfirmingDeleteChange,
  deleteFilesOnDelete,
  onDeleteFilesOnDeleteChange,
  onCommitDelete,
  renamingTarget,
  onRenamingTargetChange,
  renameDraft,
  onRenameDraftChange,
  onCommitRename,
  renameDirty,
  creatingProject,
  onCreatingProjectChange,
  projectCreateMoveTarget,
  onAfterCreateProject,
}: {
  confirmingDelete: DeleteTarget | null;
  onConfirmingDeleteChange: (target: DeleteTarget | null) => void;
  deleteFilesOnDelete: boolean;
  onDeleteFilesOnDeleteChange: (checked: boolean) => void;
  onCommitDelete: () => void | Promise<void>;
  renamingTarget: RenameTarget | null;
  onRenamingTargetChange: (target: RenameTarget | null) => void;
  renameDraft: string;
  onRenameDraftChange: (val: string) => void;
  onCommitRename: () => void | Promise<void>;
  renameDirty: boolean;
  creatingProject: boolean;
  onCreatingProjectChange: (open: boolean) => void;
  projectCreateMoveTarget: SidebarItem | null;
  onAfterCreateProject: (
    project: ProjectRecord,
    options: { stayedOnRoute: boolean },
  ) => void | Promise<void>;
}) {
  const t = useT();

  const hasFiles = confirmingDelete !== null;

  return (
    <>
      <Dialog
        open={confirmingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            onConfirmingDeleteChange(null);
            onDeleteFilesOnDeleteChange(false);
          }
        }}
      >
        <DialogContent className="menu-flat-destructive corner-squircle dialog-soft-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmingDelete?.kind === "project"
                ? t("shell.dialog.project.deleteTitle")
                : confirmingDelete?.kind === "chats"
                  ? t("shell.selection.deleteTitle")
                  : confirmingDelete?.kind === "projects"
                    ? t("shell.selection.deleteProjectsTitle")
                    : t("shell.dialog.deleteChat.title")}
            </DialogTitle>
            <DialogDescription>
              {confirmingDelete?.kind === "chat"
                ? renderEmphasizedTranslation(
                    t,
                    "shell.dialog.deleteChat.description",
                    confirmingDelete.item.title,
                  )
                : confirmingDelete?.kind === "chats"
                  ? t("shell.selection.deleteDescription", {
                      count: confirmingDelete.items.length,
                    })
                  : confirmingDelete?.kind === "projects"
                    ? t("shell.selection.deleteProjectsDescription", {
                        count: confirmingDelete.projects.length,
                      })
                    : confirmingDelete?.kind === "project"
                      ? renderEmphasizedTranslation(
                          t,
                          "shell.dialog.project.deleteDescription",
                          confirmingDelete.project.name,
                        )
                      : null}
            </DialogDescription>
          </DialogHeader>
          {hasFiles ? (
            <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-muted/35 px-3 py-2.5">
              <label
                htmlFor="delete-files-on-delete"
                className="min-w-0 space-y-1"
              >
                <span className="block text-sm font-medium text-foreground">
                  {t("shell.selection.deleteFilesLabel")}
                </span>
                <span className="block break-words text-xs leading-5 text-muted-foreground">
                  {confirmingDelete?.kind === "project"
                    ? (confirmingDelete.project.rootPath ??
                      t("shell.dialog.project.deleteWorkspaceDescription"))
                    : confirmingDelete?.kind === "projects"
                      ? t("shell.selection.deleteProjectsFilesDescription")
                      : confirmingDelete?.kind === "chats"
                        ? t("shell.selection.deleteFilesDescription")
                        : t("shell.selection.deleteChatFilesDescription")}
                </span>
              </label>
              <Switch
                id="delete-files-on-delete"
                checked={deleteFilesOnDelete}
                onCheckedChange={onDeleteFilesOnDeleteChange}
                aria-label={t("shell.selection.deleteFilesLabel")}
              />
            </div>
          ) : null}
          <DialogFooter className="flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onConfirmingDeleteChange(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void onCommitDelete()}
            >
              {hasFiles && deleteFilesOnDelete
                ? t("shell.dialog.project.deleteAll")
                : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renamingTarget?.kind === "project"}
        onOpenChange={(open) => {
          if (!open) onRenamingTargetChange(null);
        }}
      >
        <DialogContent className="corner-squircle dialog-soft-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {renamingTarget?.kind === "project"
                ? t("shell.dialog.project.renameTitle")
                : t("shell.dialog.renameChat.title")}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={renameDraft}
            onChange={(event) => onRenameDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onCommitRename();
              }
            }}
            autoFocus
            maxLength={120}
            placeholder={
              renamingTarget?.kind === "project"
                ? t("shell.dialog.project.namePlaceholder")
                : t("shell.dialog.renameChat.placeholder")
            }
            aria-label={
              renamingTarget?.kind === "project"
                ? t("shell.dialog.project.namePlaceholder")
                : t("shell.dialog.renameChat.placeholder")
            }
            className="focus-visible:border-input focus-visible:ring-0"
          />
          <DialogFooter className="flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onRenamingTargetChange(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void onCommitRename()}
              disabled={!renameDirty}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewProjectDialog
        open={creatingProject}
        onOpenChange={(open) => {
          onCreatingProjectChange(open);
        }}
        title={
          projectCreateMoveTarget
            ? t("shell.dialog.project.moveToNewTitle")
            : t("shell.dialog.project.createTitle")
        }
        submitLabel={
          projectCreateMoveTarget
            ? t("shell.dialog.project.createAndMove")
            : t("shell.dialog.project.createTitle")
        }
        onCreated={onAfterCreateProject}
      />
    </>
  );
}
