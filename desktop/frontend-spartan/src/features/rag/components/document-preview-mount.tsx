
"use client";

import { Component, lazy, Suspense, type ReactNode, useEffect, useState } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n";
import { useDocumentPreviewStore } from "./preview-store";

// pdf.js / react-pdf are heavy (~0.5 MB gzip): defer until the first citation
// click, then keep mounted for open/close anims.
const loadDocumentPreviewSheet = () =>
  import("./document-preview-sheet").then((m) => ({
    default: m.DocumentPreviewSheet,
  }));

const DocumentPreviewSheet = lazy(loadDocumentPreviewSheet);

/**
 * A rejected dynamic import used to unmount the chat because the Suspense
 * fallback was null. Keep the failure contained to the preview surface so the
 * conversation remains available and the user can close it.
 */
class DocumentPreviewLoadBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey: number },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: { resetKey: number }) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function DocumentPreviewMountState({
  failed = false,
}: {
  failed?: boolean;
}) {
  const t = useT();
  const open = useDocumentPreviewStore((state) => state.open);
  const closePreview = useDocumentPreviewStore((state) => state.closePreview);

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && closePreview()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("chat.preview.document")}</SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-2 px-6 pb-6 text-sm text-muted-foreground">
          {failed ? (
            t("chat.preview.moduleLoadError")
          ) : (
            <>
              <Spinner data-icon="inline-start" />
              {t("chat.preview.loading")}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Start fetching the viewer before the downloaded Blob is ready. */
export function preloadDocumentPreview() {
  void loadDocumentPreviewSheet().catch(() => undefined);
}

export function DocumentPreviewMount() {
  const open = useDocumentPreviewStore((s) => s.open);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // On the first click, render the lazy boundary immediately instead of
  // waiting for an effect tick. This makes the Sheet available as soon as the
  // local preview state opens.
  if (!mounted && !open) return null;
  return (
    <DocumentPreviewLoadBoundary
      resetKey={open ? 1 : 0}
      fallback={<DocumentPreviewMountState failed={true} />}
    >
      <Suspense fallback={<DocumentPreviewMountState />}>
        <DocumentPreviewSheet />
      </Suspense>
    </DocumentPreviewLoadBoundary>
  );
}
