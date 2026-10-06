import { useT as useUiT } from "@/i18n";
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
import type { TransportConflictInfo } from "@/features/hub/download-manager";

export type { TransportConflictInfo } from "@/features/hub/download-manager";

export function TransportConflictDialog({
  conflict,
  onCancel,
  onKeepTransport,
  onSwitchTransport,
}: {
  conflict: TransportConflictInfo | null;
  onCancel: () => void;
  // Continue on the partial download's existing transport (resumes if possible);
  // distinct from switching transport, which always restarts from scratch.
  onKeepTransport: () => void;
  onSwitchTransport: () => void;
}) {
  const uiT = useUiT();

  const previousLabel = conflict?.previous.toUpperCase() ?? "";
  const nextLabel = conflict?.next.toUpperCase() ?? "";
  const description = conflict?.resumable ? (
    <>
      {uiT("ui.you_started_this_download_with")}{" "}
      <span className="font-medium text-foreground">{previousLabel}</span>{uiT("ui.but_your_current_setting_is")}{" "}
      <span className="font-medium text-foreground">{nextLabel}</span>{uiT("ui.resume_with")}{" "}{previousLabel} {" "}{uiT("ui.to_keep_the_progress_you_already_have_or_restart_with")}{" "}{nextLabel} {" "}{uiT("ui.to_begin_from_scratch")}</>
  ) : (
    <>
      {uiT("ui.your_previous_download_used")}{" "}
      <span className="font-medium text-foreground">{previousLabel}</span>{uiT("ui.which_can_t_resume_its_partial_files_so_the_existing_partial_will")}{" "}{previousLabel} {" "}{uiT("ui.to_keep_it_usually_faster_or_restart_with")}{" "}
      {nextLabel} {" "}{uiT("ui.so_future_cancels_can_resume")}</>
  );
  const primaryLabel = conflict?.resumable
    ? `Resume with ${previousLabel}`
    : `Restart with ${previousLabel}`;
  const secondaryLabel = `Restart with ${nextLabel}`;
  return (
    <AlertDialog
      open={conflict !== null}
      onOpenChange={(o) => {
        if (!o) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent className="sm:!max-w-[22rem]">
        <AlertDialogHeader>
          <AlertDialogTitle>{uiT("ui.different_transport_mode")}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="!flex !flex-col gap-2 sm:!flex-col sm:!justify-stretch">
          <AlertDialogAction
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              onKeepTransport();
            }}
          >
            {primaryLabel}
          </AlertDialogAction>
          <AlertDialogAction
            variant="outline"
            className="w-full !bg-transparent hover:!bg-transparent"
            onClick={(e) => {
              e.preventDefault();
              onSwitchTransport();
            }}
          >
            {secondaryLabel}
          </AlertDialogAction>
          <AlertDialogCancel className="w-full !bg-transparent hover:!bg-transparent">
            {uiT("chat.workspace.cancel")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
