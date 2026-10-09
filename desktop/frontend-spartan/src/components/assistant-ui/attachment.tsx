import { useT as useUiT } from "@/i18n";
"use client";

// Avatar removed — caused circular crop on image thumbnails
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PASTED_TEXT_PREVIEW_MAX_CHARS,
  isPastedTextContent,
  isPastedTextFile,
  pastedTextContentBytes,
  pastedTextContentPreview,
  pastedTextPreview,
} from "@/features/chat";
import { formatBytes } from "@/features/hub";
import { useDocumentPreviewStore } from "@/features/rag/components/preview-store";
import { useT } from "@/i18n";
import {
  getAttachmentFileKind,
  getAttachmentIcon,
} from "@/lib/attachment-file-kind";
import { cn } from "@/lib/utils";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { TextAlignLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronRightIcon, PlusIcon, XIcon } from "lucide-react";
import {
  type FC,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useShallow } from "zustand/shallow";

const useFileSrc = (file: File | undefined): string | undefined => {
  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setObjectUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return objectUrl;
};

const useAttachmentSrc = (): string | undefined => {
  const { file, src } = useAuiState(
    useShallow(({ attachment }): { file?: File; src?: string } => {
      if (attachment.type !== "image") {
        return {};
      }
      if (attachment.file) {
        return { file: attachment.file };
      }
      const src = attachment.content?.filter((c) => c.type === "image")[0]
        ?.image;
      if (!src) {
        return {};
      }
      return { src };
    }),
  );

  return useFileSrc(file) ?? src;
};

const AttachmentThumb: FC = () => {
  const uiT = useUiT();

  const src = useAttachmentSrc();
  const name = useAuiState(({ attachment }) => attachment.name);
  const contentType = useAuiState(
    ({ attachment }) =>
      (attachment as { file?: File }).file?.type ??
      (attachment as { contentType?: string }).contentType ??
      "",
  );

  if (src) {
    return (
      <img
        src={src}
        alt={name || uiT("ui.attachment_preview")}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <HugeiconsIcon
        icon={getAttachmentIcon(name, contentType)}
        strokeWidth={2}
        className="size-6 text-muted-foreground"
      />
    </div>
  );
};

type PastedTextAttachment = {
  readonly file?: File;
  readonly sentText?: string;
  readonly sentBytes?: number;
};

// Long pastes arrive as a synthetic .txt and render as a chip, not a tile.
// The selector only passes references along: the text can be megabytes, so
// nothing here may copy or scan it.
const usePastedTextAttachment = (): PastedTextAttachment | null => {
  return useAuiState(
    useShallow(({ attachment }): PastedTextAttachment | null => {
      if (attachment.type !== "document") {
        return null;
      }
      const file = (attachment as { file?: File }).file;
      const sentText = attachment.content?.flatMap((part) =>
        part.type === "text" ? [part.text] : [],
      )[0];
      const pasted = file
        ? isPastedTextFile(file)
        : isPastedTextContent(sentText);
      if (!pasted) {
        return null;
      }
      return { file, sentText, sentBytes: pastedTextContentBytes(sentText) };
    }),
  );
};

/** Only the composer inlines, and there the File is always still around. */
const readPastedText = async ({
  file,
}: PastedTextAttachment): Promise<string> => (file ? await file.text() : "");

const readPastedTextPreview = async (
  attachment: PastedTextAttachment,
): Promise<{ text: string; remaining: number }> => {
  if (attachment.sentText !== undefined) {
    return pastedTextContentPreview(attachment.sentText);
  }
  return pastedTextPreview(await readPastedText(attachment));
};

const PastedTextPreviewDialog: FC<
  PropsWithChildren<{ name: string; attachment: PastedTextAttachment }>
> = ({ attachment, children, name }) => {
  const uiT = useUiT();

  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{
    text: string;
    remaining: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    // Laying out megabytes in one text node locks the page, so show an
    // opening. The attachment itself still holds everything.
    readPastedTextPreview(attachment)
      .then((value) => {
        if (!cancelled) {
          setPreview(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview({ text: "", remaining: 0 });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, attachment]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild={true}>{children}</DialogTrigger>
      <DialogContent className="aui-pasted-text-dialog flex max-h-[88dvh] w-[min(68rem,94vw)] max-w-none flex-col gap-3 overflow-hidden">
        <DialogTitle className="truncate pr-8 text-sm">{name}</DialogTitle>
        <pre className="aui-pasted-text-dialog-body max-h-[72dvh] overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-3 text-left font-mono text-xs leading-relaxed">
          {preview?.text ?? uiT("chat.projectSwitcher.loading")}
        </pre>
        {preview && preview.remaining > 0 ? (
          <p className="text-muted-foreground text-xs">
            {uiT("ui.first_value0_characters_shown_value1_more_were_sent_with_the_mess", { value0: String(PASTED_TEXT_PREVIEW_MAX_CHARS.toLocaleString()), value1: String(preview.remaining.toLocaleString()) })}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const PastedTextAttachmentUI: FC<{
  attachment: PastedTextAttachment;
  isComposer: boolean;
  name: string;
}> = ({ attachment, isComposer, name }) => {
  const uiT = useUiT();

  const aui = useAui();
  const attachmentId = useAuiState(({ attachment: state }) => state.id);
  const [inlining, setInlining] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // Read off the header, never measured: the paste can be megabytes and this
  // runs while the thread is trying to paint.
  const bytes = attachment.file?.size ?? attachment.sentBytes;

  // Clicking the chip pours the text back into the composer.
  const showInTextField = useCallback(() => {
    if (inlining) {
      return;
    }
    setInlining(true);
    void readPastedText(attachment)
      .then((text) => {
        // Reading a big file is slow enough to outlive the send that cleared
        // the composer, which would leave the text behind as a stray draft.
        if (!mountedRef.current || text.length === 0) {
          return;
        }
        const composer = aui.composer();
        if (
          !composer
            .getState()
            .attachments.some((item) => item.id === attachmentId)
        ) {
          return;
        }
        const current = composer.getState().text;
        composer.setText(current.length > 0 ? `${current}\n\n${text}` : text);
        aui.attachment().remove();
      })
      .catch(() => undefined)
      .finally(() => {
        if (mountedRef.current) {
          setInlining(false);
        }
      });
  }, [attachment, attachmentId, aui, inlining]);

  const chip = (
    <button
      className={cn(
        // Borderless, and in dark mode a shade under the composer surface.
        "aui-pasted-text-chip group flex h-14 max-w-[15rem] min-w-0 cursor-pointer items-center gap-2.5 rounded-[14px] bg-muted px-3 text-left transition-colors hover:bg-muted-foreground/15 dark:bg-background dark:hover:bg-muted",
        // Keep the label clear of the remove button in the corner.
        isComposer && "aui-pasted-text-chip-composer pr-6",
      )}
      type="button"
      aria-label={
        isComposer
          ? `Pasted text: ${name}. Show in text field`
          : `Pasted text: ${name}. Show contents`
      }
      onClick={isComposer ? showInTextField : undefined}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
        <HugeiconsIcon
          icon={TextAlignLeft01Icon}
          strokeWidth={2}
          className="size-4 text-muted-foreground"
        />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-xs">{name}</span>
        <span className="truncate text-ui-11 text-muted-foreground">
          {/* Hover swaps the size for the action. */}
          <span className={isComposer ? "group-hover:hidden" : undefined}>
            {bytes === undefined ? uiT("ui.pasted_text") : formatBytes(bytes)}
          </span>
          {isComposer ? (
            <span className="hidden items-center gap-0.5 underline underline-offset-2 group-hover:inline-flex">
              {uiT("ui.show_in_text_field")}<ChevronRightIcon className="size-3" />
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );

  return (
    <AttachmentPrimitive.Root className="aui-attachment-root relative">
      {isComposer ? (
        chip
      ) : (
        <PastedTextPreviewDialog attachment={attachment} name={name}>
          {chip}
        </PastedTextPreviewDialog>
      )}
      {isComposer && <AttachmentRemove />}
    </AttachmentPrimitive.Root>
  );
};

const AttachmentUI: FC = () => {
  const aui = useAui();
  const isComposer = aui.attachment.source === "composer";
  const pastedText = usePastedTextAttachment();

  const isImage = useAuiState(({ attachment }) => attachment.type === "image");
  const name = useAuiState(({ attachment }) => attachment.name);
  // External-store snapshots must keep their identity between updates.
  // Subscribe to existing references rather than allocating a preview object
  // on every read (which makes useSyncExternalStore rerender indefinitely).
  const previewFile = useAuiState(
    ({ attachment }) => (attachment as { file?: File }).file,
  );
  const previewAttachmentId = useAuiState(({ attachment }) => attachment.id);
  const previewContent = useAuiState(
    ({ attachment }) => attachment.content?.find((part) => part.type === "file") as
      | { type: "file"; data: string; mimeType?: string }
      | undefined,
  );
  const previewContentType = useAuiState(
    ({ attachment }) => (attachment as { contentType?: string }).contentType ?? "",
  );
  const previewImageSrc = useAuiState(
    ({ attachment }) => attachment.content?.find((part) => part.type === "image")?.image,
  );
  const openLocalPreview = useDocumentPreviewStore(
    (state) => state.openLocalPreview,
  );
  const typeLabel = useAuiState(({ attachment }) => {
    const type = attachment.type;
    switch (type) {
      case "image":
        return "Image";
      case "document":
        return "Document";
      case "file": {
        const kind = getAttachmentFileKind(
          attachment.name,
          (attachment as { file?: File }).file?.type ?? "",
        );
        return kind === "audio" ? "Audio" : kind === "video" ? "Video" : "File";
      }
      default:
        throw new Error(`Unknown attachment type: ${type as string}`);
    }
  });
  // Filename in accessible name lets screen readers distinguish same-typed
  // attachments. Sighted users get it via the tooltip.
  const accessibleName = name
    ? `${typeLabel} attachment: ${name}`
    : `${typeLabel} attachment`;
  const handlePreview = useCallback(() => {
    if (!name) {
      return;
    }
    const kind = getAttachmentFileKind(
      name,
      previewFile?.type ?? previewContent?.mimeType ?? previewContentType,
    );
    if (previewFile) {
      openLocalPreview({ blob: previewFile, filename: name, kind, attachmentId: previewAttachmentId });
      return;
    }
    const data = previewContent?.data ?? previewImageSrc;
    if (!data) {
      return;
    }
    fetch(data)
      .then((response) => response.blob())
      .then((blob) => {
        if (isComposer && !aui.composer().getState().attachments.some((item) => item.id === previewAttachmentId)) return;
        openLocalPreview({ blob, filename: name, kind, attachmentId: previewAttachmentId });
      })
      .catch(() => undefined);
  }, [name, openLocalPreview, previewFile, previewContent, previewContentType, previewImageSrc, isComposer, previewAttachmentId, aui]);

  if (pastedText) {
    return (
      <PastedTextAttachmentUI
        attachment={pastedText}
        isComposer={isComposer}
        name={name ?? "Pasted text"}
      />
    );
  }

  return (
    <Tooltip>
      <AttachmentPrimitive.Root
        className={cn(
          "aui-attachment-root relative",
          isImage &&
            "aui-attachment-root-composer only:[&>#attachment-tile]:size-16",
        )}
      >
        {isImage ? (
          <>
            <TooltipTrigger asChild={true}>
              <button
                className={cn(
                  "aui-attachment-tile size-14 cursor-pointer overflow-hidden rounded-[14px] border bg-muted transition-opacity hover:opacity-75",
                  isComposer &&
                    "aui-attachment-tile-composer border-foreground/20",
                )}
                id="attachment-tile"
                aria-label={accessibleName}
                type="button"
                onClick={handlePreview}
              >
                <AttachmentThumb />
              </button>
            </TooltipTrigger>
          </>
        ) : (
          <TooltipTrigger asChild={true}>
            <button
              className={cn(
                "aui-attachment-tile size-14 cursor-pointer overflow-hidden rounded-[14px] border bg-muted transition-opacity hover:opacity-75",
                isComposer &&
                  "aui-attachment-tile-composer border-foreground/20",
              )}
              id="attachment-tile"
              aria-label={accessibleName}
              type="button"
              onClick={handlePreview}
            >
              <AttachmentThumb />
            </button>
          </TooltipTrigger>
        )}
        {isComposer && <AttachmentRemove />}
      </AttachmentPrimitive.Root>
      <TooltipContent side="top" className="tooltip-compact">
        <AttachmentPrimitive.Name />
      </TooltipContent>
    </Tooltip>
  );
};

const AttachmentRemove: FC = () => {
  const t = useT();
  const attachmentId = useAuiState(({ attachment }) => attachment.id);
  return (
    <AttachmentPrimitive.Remove asChild={true}>
      <TooltipIconButton
        tooltip={t("chat.composer.removeFile")}
        aria-label={t("chat.composer.removeFile")}
        className="aui-attachment-tile-remove absolute top-1.5 right-1.5 size-3.5 rounded-full bg-white text-muted-foreground opacity-100 shadow-sm hover:bg-white! [&_svg]:text-black hover:[&_svg]:text-destructive"
        side="top"
        onClick={() => useDocumentPreviewStore.getState().removeAttachmentPreview(attachmentId)}
      >
        <XIcon className="aui-attachment-remove-icon size-3 dark:stroke-[2.5px]" />
      </TooltipIconButton>
    </AttachmentPrimitive.Remove>
  );
};

export const UserMessageAttachments: FC = () => {
  return (
    <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2">
      <MessagePrimitive.Attachments components={{ Attachment: AttachmentUI }} />
    </div>
  );
};

export const ComposerAttachments: FC = () => {
  const attachments = useAuiState(({ composer }) => composer.attachments);
  const previousIds = useRef(new Set<string>());
  useEffect(() => {
    const current = new Set(attachments.map((attachment) => attachment.id));
    for (const id of previousIds.current) {
      if (!current.has(id)) useDocumentPreviewStore.getState().removeAttachmentPreview(id);
    }
    previousIds.current = current;
  }, [attachments]);
  return (
    <div className="aui-composer-attachments mb-2 flex w-full flex-row items-center gap-2 overflow-x-auto px-1.5 pt-0.5 pb-1 empty:hidden">
      <ComposerPrimitive.Attachments
        components={{ Attachment: AttachmentUI }}
      />
    </div>
  );
};

export const ComposerAddAttachment: FC = () => {
  const t = useT();
  return (
    <ComposerPrimitive.AddAttachment asChild={true}>
      <TooltipIconButton
        tooltip={t("chat.composer.addAttachment")}
        aria-label={t("chat.composer.addAttachment")}
        side="bottom"
        variant="ghost"
        size="icon"
        className="aui-composer-add-attachment size-8.5 rounded-full p-1 font-semibold text-xs hover:bg-muted-foreground/15 dark:hover:bg-muted-foreground/30"
      >
        <PlusIcon className="aui-attachment-add-icon size-5 stroke-[1.5px]" />
      </TooltipIconButton>
    </ComposerPrimitive.AddAttachment>
  );
};
