import { translate as uiTranslate } from "@/i18n";
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
import { authFetch } from "@/features/auth";
import { toastError } from "@/shared/toast";
import { useState } from "react";

interface ShutdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after shutdown succeeds, before we replace document.body. Lets
   *  callers remove their beforeunload listener so the browser doesn't prompt
   *  "Leave site?" when closing the final tab. */
  onAfterShutdown?: () => void;
}

export function ShutdownDialog({
  open,
  onOpenChange,
  onAfterShutdown,
}: ShutdownDialogProps) {
  const uiT = useUiT();

  const [stopping, setStopping] = useState(false);

  const handleStop = async () => {
    setStopping(true);
    let accepted = false;
    try {
      const res = await authFetch("/api/shutdown", { method: "POST" });
      accepted = res.ok;
      if (!accepted) {
        toastError(uiTranslate("ui.failed_to_shut_down_server"));
        setStopping(false);
        return;
      }
    } catch {
      // Network error: request never reached the server
      toastError(uiTranslate("ui.could_not_reach_server"));
      setStopping(false);
      return;
    }

    onAfterShutdown?.();
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;gap:12px">
        <p style="font-size:calc(1.1rem * var(--ui-font-scale, 1));font-weight:600;margin:0">Sparta se ha detenido.</p>
        <p style="font-size:calc(0.9rem * var(--ui-font-scale, 1));color:#888;margin:0">You can now close this tab.</p>
      </div>`;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{uiT("ui.stop_sparta")}</AlertDialogTitle>
          <AlertDialogDescription>
            {uiT("ui.this_will_shut_down_the_server_any_active_training_or_inference_j")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{uiT("chat.workspace.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleStop}
            disabled={stopping}
            variant="destructive"
          >
            {stopping ? uiT("ui.stopping") : uiT("ui.stop_server")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
