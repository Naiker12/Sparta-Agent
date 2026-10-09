import { translate as uiTranslate } from "@/i18n";







export type ScanFolderStatus =
  | "ok"
  | "permission_denied"
  | "missing"
  | "unreadable"
  | "partial";

export interface ScanFolderStatusCopy {
  title: string;
  hint: string;
}

/** Rough host detection: only picks which settings screen to name. */
function hostPlatform(userAgent: string): "mac" | "windows" | "other" {
  if (/Mac|iPhone|iPad/i.test(userAgent)) {
    return "mac";
  }
  if (/Win/i.test(userAgent)) {
    return "windows";
  }
  return "other";
}

function permissionHint(userAgent: string): string {
  switch (hostPlatform(userAgent)) {
    case "mac":
      return "Grant access in System Settings > Privacy & Security > Files and Folders, then reopen this dialog.";
    case "windows":
      return "Check the folder's security permissions, or allow Spartan in Controlled Folder Access, then reopen this dialog.";
    default:
      return "Check the folder's permissions, then reopen this dialog.";
  }
}

export function scanFolderStatusCopy(
  status: ScanFolderStatus | undefined,
  userAgent: string = typeof navigator === "undefined"
    ? ""
    : navigator.userAgent,
): ScanFolderStatusCopy | null {
  switch (status) {
    case "permission_denied":
      return {
        title: "Spartan is not allowed to read this folder",
        hint: permissionHint(userAgent),
      };
    case "partial":
      return {
        get title() { return uiTranslate("ui.some_models_in_this_folder_could_not_be_read"); },
        hint: permissionHint(userAgent),
      };
    case "missing":
      return {
        get title() { return uiTranslate("ui.this_folder_is_no_longer_there"); },
        get hint() { return uiTranslate("ui.it_was_moved_renamed_or_is_on_a_drive_that_is_not_connected"); },
      };
    case "unreadable":
      return {
        get title() { return uiTranslate("ui.this_folder_could_not_be_read"); },
        get hint() { return uiTranslate("ui.the_drive_may_be_disconnected_or_failing_check_it_then_reopen_thi"); },
      };
    default:
      return null;
  }
}
