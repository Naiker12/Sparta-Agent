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
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ArrowReloadHorizontalIcon,
  Delete02Icon,
  Download01Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import {
  type DownloadJob,
  type DownloadJobProgress,
  DownloadProgressBar,
} from "../download-manager";
import {
  DownloadStopIndicator,
  type DownloadStopMode,
} from "./download-cancel-indicator";
import { TransportConflictDialog } from "./transport-conflict-dialog";
import {
  downloadActionAriaLabel,
  downloadActionLabel,
} from "./use-download-card-state";

/**
 * Shared shell for every download surface (safetensors, GGUF, dataset): card
 * frame, progress bar, transport-conflict dialog, plus card-specific `dialogs`
 * and children.
 */
export function DownloadCard({
  job,
  progress,
  children,
  dialogs,
}: {
  job: DownloadJob;
  progress: DownloadJobProgress | null;
  children: ReactNode;
  dialogs?: ReactNode;
}) {
  return (
    <>
      <div className="hub-download-card">
        <div className="group/dl flex items-center">{children}</div>
        {progress && (
          // Match the row's inner text bounds: the trigger and the action
          // button both inset 12px, so the bar lines up with the quant label
          // on the left and the percentage on the right.
          <div className="px-3">
            <DownloadProgressBar
              progress={progress}
              bytesPerSec={job.bytesPerSec}
            />
          </div>
        )}
      </div>
      <TransportConflictDialog
        conflict={job.transportConflict}
        onCancel={job.cancelConflict}
        onKeepTransport={job.resumeConflict}
        onSwitchTransport={job.restartConflict}
      />
      {dialogs}
    </>
  );
}

/** Vertical hairline that fades out on row hover, separating info from actions. */
export function CardDivider() {
  return (
    <div
      aria-hidden="true"
      className="ml-1 mr-0 h-5 w-px shrink-0 bg-foreground/[0.06] opacity-100 transition-opacity duration-150 group-hover/dl:opacity-0 dark:bg-white/[0.04]"
    />
  );
}

export function CardSettingsButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground opacity-0 transition-[opacity,background-color,color] duration-150 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:opacity-100 group-hover/dl:opacity-100 dark:hover:bg-white/[0.08]"
        >
          <HugeiconsIcon
            icon={Settings02Icon}
            strokeWidth={1.75}
            className="size-4"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="tooltip-compact">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function CardDeleteButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const uiT = useUiT();

  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground opacity-0 transition-[opacity,background-color,color] duration-150 hover:bg-rose-500/10 hover:text-rose-600 focus-visible:opacity-100 group-hover/dl:opacity-100 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
        >
          <HugeiconsIcon
            icon={Delete02Icon}
            strokeWidth={1.75}
            className="size-4"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {uiT("ui.delete_from_device")}</TooltipContent>
    </Tooltip>
  );
}

export function CardUpdateButton({
  label,
  onClick,
  emphasized = false,
}: {
  label: string;
  onClick: () => void;
  /** When true (a newer revision is available) the control becomes a prominent
   *  labeled amber pill instead of the quiet hover-revealed icon — the
   *  "update available" cue. Amber is the established status tone in this surface
   *  (the older-cache hint banner), kept tinted (never solid) per the design
   *  system's feedback-color convention, so the one emerald accent stays scarce. */
  emphasized?: boolean;
}) {
  const uiT = useUiT();

  if (emphasized) {
    return (
      <Tooltip>
        <TooltipTrigger asChild={true}>
          <button
            type="button"
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-amber-500/[0.07] pl-2 pr-2.5 text-ui-12 font-medium text-amber-800/90 transition-colors duration-150 hover:bg-amber-500/[0.12] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/25 dark:bg-amber-400/[0.08] dark:text-amber-200/85 dark:hover:bg-amber-400/[0.16]"
          >
            <HugeiconsIcon
              icon={ArrowReloadHorizontalIcon}
              strokeWidth={2}
              className="size-3.5"
            />
            {uiT("update.update")}</button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {uiT("ui.a_newer_version_is_available_on_hugging_face")}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground opacity-0 transition-[opacity,background-color,color] duration-150 hover:bg-amber-500/10 hover:text-amber-600 focus-visible:opacity-100 group-hover/dl:opacity-100 dark:hover:bg-amber-500/15 dark:hover:text-amber-400"
        >
          <HugeiconsIcon
            icon={ArrowReloadHorizontalIcon}
            strokeWidth={1.75}
            className="size-4"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {uiT("ui.update_from_hugging_face")}</TooltipContent>
    </Tooltip>
  );
}

/** Download / Cancel / Resume button for the safetensors and dataset cards. */
export function DownloadActionButton({
  downloading,
  cancelling,
  loading = false,
  isPartial = false,
  partialResumable = false,
  stopMode = "cancel",
  progressPercent = null,
  disabled,
  onClick,
  className,
}: {
  downloading: boolean;
  cancelling: boolean;
  loading?: boolean;
  isPartial?: boolean;
  /** This row's partial can be continued byte for byte (backend verdict). */
  partialResumable?: boolean;
  /** What stopping the running job costs; see downloadStopMode. */
  stopMode?: DownloadStopMode;
  progressPercent?: number | null;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  const uiT = useUiT();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={downloadActionAriaLabel(downloading, cancelling, stopMode)}
      className={cn(
        "hub-action-btn w-28",
        (loading || cancelling) && "opacity-70",
        downloading &&
          !cancelling &&
          "hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400",
        className,
      )}
    >
      {cancelling ? (
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <Spinner />
          {uiT("settings.voice.dictation.sttCancellingDownload")}</span>
      ) : downloading ? (
        <>
          <DownloadStopIndicator mode={stopMode} />
          {progressPercent != null ? `${progressPercent}%` : null}
        </>
      ) : loading ? (
        <>
          <Spinner />
          {uiT("chat.projectSwitcher.loading")}</>
      ) : (
        <>
          <HugeiconsIcon icon={Download01Icon} strokeWidth={1.75} />
          {downloadActionLabel(isPartial, partialResumable)}
        </>
      )}
    </button>
  );
}

/** Confirmation dialog shared by the model, quantization, and dataset delete flows. */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  deleting,
  blocked = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  deleting: boolean;
  /** Another installed model needs these files. Confirming would 400, so do not offer it. */
  blocked?: boolean;
  onConfirm: () => void;
}) {
  const uiT = useUiT();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{uiT("chat.workspace.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting || blocked}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {deleting ? uiT("ui.deleting") : uiT("chat.menu.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Confirmation dialog shared by the model and quantization update flows. */
export function UpdateConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  updating,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  updating: boolean;
  onConfirm: () => void;
}) {
  const uiT = useUiT();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={updating}>{uiT("chat.workspace.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="default"
            disabled={updating}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {updating ? uiT("ui.updating") : uiT("update.update")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
