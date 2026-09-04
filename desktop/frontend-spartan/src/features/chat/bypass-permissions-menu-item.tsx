
import { ShieldBanIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

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
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useT } from "@/i18n";
import {
  FULL_ACCESS_WARNING,
  PermissionModeMenuItems,
} from "./permission-mode-select";

// Tool permissions entry for the composer "+" menu.
export function BypassPermissionsMenuItem() {
  const t = useT();
  const permissionMode = useChatRuntimeStore((s) => s.permissionMode);
  const setBypassConfirmOpen = useChatRuntimeStore(
    (s) => s.setBypassConfirmOpen,
  );

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        className={
          permissionMode === "full" ? "text-bypass font-medium" : undefined
        }
      >
        <HugeiconsIcon icon={ShieldBanIcon} strokeWidth={2} />
        {t("chat.composer.permissions.toolPermissions")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="unsloth-plus-menu w-[300px]">
        <PermissionModeMenuItems
          // Defer past Radix's menu-close focus restoration: opening the
          // dialog synchronously here lets the dropdown grab focus back and
          // breaks the dialog's focus trap.
          onRequestFullAccess={() =>
            setTimeout(() => setBypassConfirmOpen(true), 0)
          }
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// The danger-confirmation dialog. Mounted once at the chat-page root (not inside
// a Composer or the menu) and driven by global store state, so it works for both
// the main and shared composers, never duplicates in Compare mode, and confirming
// or cancelling never leaves the composer "+"/More popovers frozen open.
export function BypassPermissionsConfirmDialog() {
  const t = useT();
  const open = useChatRuntimeStore((s) => s.bypassConfirmOpen);
  const setOpen = useChatRuntimeStore((s) => s.setBypassConfirmOpen);
  const setPermissionMode = useChatRuntimeStore((s) => s.setPermissionMode);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("chat.composer.permissions.fullAccessDialog.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("chat.composer.permissions.fullAccessDialog.warning")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t("chat.composer.permissions.fullAccessDialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
            onClick={() => {
              setPermissionMode("full");
              setOpen(false);
            }}
          >
            {t("chat.composer.permissions.fullAccessDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
