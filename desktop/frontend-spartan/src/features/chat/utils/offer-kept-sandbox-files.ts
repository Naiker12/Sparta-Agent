
import { toast } from "sonner";
import { translate } from "@/i18n";
import { deleteStoredChatThreads } from "./chat-history-storage";

/**
 * Offer to delete sandbox files a delete kept.
 *
 * Once the chats are gone there is no card left to reach those folders from,
 * so every delete surface that cannot ask up front makes the offer here.
 */
export function offerToDeleteKeptSandboxes(keptThreadIds: string[]): void {
  if (keptThreadIds.length === 0) return;
  toast(
    keptThreadIds.length === 1
      ? translate("chat.keptSandboxFiles.one")
      : translate("chat.keptSandboxFiles.many", { count: keptThreadIds.length }),
    {
      description:
        keptThreadIds.length === 1
          ? translate("chat.keptSandboxFiles.oneDescription")
          : translate("chat.keptSandboxFiles.manyDescription"),
      action: {
        label: translate("chat.keptSandboxFiles.deleteFiles"),
        onClick: () => {
          void deleteStoredChatThreads(keptThreadIds, { deleteFiles: true })
            .then((stillKept) => {
              // A tool still running in there, a surviving fork, or a folder
              // that would not go: the request succeeded and the files did not,
              // so this offer is the only way back to them.
              if (stillKept.length > 0) offerToDeleteKeptSandboxes(stillKept);
            })
            .catch(() => {
              toast.error(translate("chat.keptSandboxFiles.deleteFailed"));
            });
        },
      },
    },
  );
}
