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
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useHfTokenWarningStore } from "./store";

export function HfTokenWarningDialog() {
  const uiT = useUiT();

  const open = useHfTokenWarningStore((state) => state.open);
  const allowAnonymous = useHfTokenWarningStore(
    (state) => state.allowAnonymous,
  );
  const resolve = useHfTokenWarningStore((state) => state.resolve);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resolve("cancel");
        }
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5" />
            </div>
            <div className="space-y-1 text-left">
              <AlertDialogTitle>{uiT("ui.hugging_face_token_is_invalid")}</AlertDialogTitle>
              <AlertDialogDescription>
                {allowAnonymous
                  ? uiT("ui.hugging_face_rejected_the_saved_token_replace_it_to_access_privat")
                  : uiT("ui.hugging_face_rejected_the_saved_token_replace_it_before_uploading")}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-between">
          <AlertDialogCancel onClick={() => resolve("cancel")}>
            {uiT("chat.workspace.cancel")}</AlertDialogCancel>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {allowAnonymous ? (
              <Button variant="outline" onClick={() => resolve("anonymous")}>
                {uiT("ui.continue_without_token")}</Button>
            ) : null}
            <AlertDialogAction onClick={() => resolve("replace")}>
              {uiT("ui.replace_token")}</AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
