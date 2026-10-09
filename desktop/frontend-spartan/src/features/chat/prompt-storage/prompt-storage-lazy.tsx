import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/i18n";

const LoadedDialog = lazy(() => import("./prompt-storage-dialog")
  .then(({ PromptStorageDialog }) => ({ default: PromptStorageDialog })));
type Props = ComponentProps<typeof LoadedDialog>;

/** Do not initialize storage UI until first use; preserve its state thereafter. */
export function PromptStorageDialog(props: Props) {
  const t = useT();
  const [hasOpened, setHasOpened] = useState(props.open);
  useEffect(() => { if (props.open) setHasOpened(true); }, [props.open]);
  if (!props.open && !hasOpened) return null;
  return <Suspense fallback={
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ui.prompt_storage")}</DialogTitle>
          <DialogDescription role="status">{t("common.loading")}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  }><LoadedDialog {...props} /></Suspense>;
}
