"use client";

import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { MAX_HIGHLIGHT_CHARS } from "@/lib/markdown-plugins";
import { downloadFile, isDownloadCancelled } from "@/lib/native-files";
import { toast } from "@/lib/toast";
import { code as codePlugin } from "@streamdown/code";
import { CopyIcon, DownloadIcon, Maximize2Icon } from "lucide-react";
import { useT } from "@/i18n";
import { Tick02Icon } from "@/lib/tick-icon";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";

import { CodeViewerModal } from "./code-viewer-modal";

const COPY_RESET_MS = 2000;
const SHIKI_THEME = ["github-light", "github-dark"] as [
  "github-light",
  "github-dark",
];
/** Within this many px of the bottom counts as following the stream. */
const PIN_SLACK_PX = 40;

export function CopyBtn({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const copy = useCallback(async () => {
    if (await copyToClipboard(text)) {
      setCopied(true);
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => setCopied(false), COPY_RESET_MS);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={t("chat.tools.codeViewer.copy")}
    >
      {copied ? (
        <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-3" />
      ) : (
        <CopyIcon className="size-3" />
      )}
      {!compact &&
        (copied
          ? t("chat.tools.codeViewer.copied")
          : t("chat.tools.codeViewer.copy"))}
    </button>
  );
}

export function DownloadBtn({
  code,
  name,
  compact = false,
}: {
  code: string;
  name: string;
  compact?: boolean;
}) {
  const t = useT();
  // Route through the shared boundary: browsers keep the normal download,
  // Tauri gets the native save chooser. A bare blob anchor is silently
  // dropped by the desktop WebView2.
  const download = useCallback(() => {
    void downloadFile(code, name, "text/plain;charset=utf-8").catch((error) => {
      if (!isDownloadCancelled(error)) {
        toast.error(t("chat.tools.codeViewer.saveFailed"));
      }
    });
  }, [code, name, t]);

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={t("chat.tools.codeViewer.download")}
    >
      <DownloadIcon className="size-3" />
      {!compact && t("chat.tools.codeViewer.download")}
    </button>
  );
}

/** A fence longer than any backtick run in the code, so a script containing ``` cannot end it early. */
function fenceFor(source: string): string {
  const longest = (source.match(/`+/g) ?? []).reduce(
    (max, run) => Math.max(max, run.length),
    0,
  );
  return "`".repeat(Math.max(3, longest + 1));
}

/** Syntax-highlighted code via Streamdown + shiki. Always in the DOM as plain monospace, but
 * shiki only tokenizes once the block nears the viewport, so a long transcript does not
 * highlight every script up front. Immediate where IntersectionObserver is missing. */
export function HighlightedCode({
  code: source,
  language,
  plain = false,
  expanded = false,
  lineNumbers = false,
}: {
  code: string;
  language: string;
  plain?: boolean;
  expanded?: boolean;
  lineNumbers?: boolean;
}) {
  const markdown = useMemo(() => {
    const fence = fenceFor(source);
    return `${fence}${language}\n${source}\n${fence}`;
  }, [source, language]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  // Pinned to the bottom until the reader scrolls up, so a streaming payload visibly grows.
  const pinnedToBottom = useRef(true);
  useEffect(() => {
    if (nearViewport) return;
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          io.disconnect();
        }
      },
      // Highlight just before the block enters view, so it is ready on arrival.
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [nearViewport]);

  useEffect(() => {
    const el = containerRef.current;
    if (plain && el && pinnedToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [plain, source]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (el) {
      pinnedToBottom.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < PIN_SLACK_PX;
    }
  };

  // Skip shiki while the model is writing (it re-tokenizes every fragment) and on payloads too big.
  const highlight =
    nearViewport && !plain && source.length <= MAX_HIGHLIGHT_CHARS;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={
        expanded
          ? "h-full overflow-auto text-xs"
          : "max-h-48 overflow-auto text-xs"
      }
    >
      <div className="flex min-w-max">
        {lineNumbers && (
          <div
            aria-hidden="true"
            className="sticky left-0 z-[1] select-none border-r bg-muted/40 py-4 text-right font-mono leading-5 text-muted-foreground/60"
          >
            {Array.from(
              { length: Math.max(1, source.split("\n").length) },
              (_, index) => (
                <div key={index} className="min-w-12 px-3">
                  {index + 1}
                </div>
              ),
            )}
          </div>
        )}
        <div
          className={
            expanded
              ? "min-w-0 flex-1 [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!text-xs [&_pre]:!leading-5 [&_[data-streamdown=code-block]]:!my-0 [&_[data-streamdown=code-block]]:!border-0 [&_[data-streamdown=code-block]]:!p-4"
              : "min-w-0 flex-1 [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!text-xs [&_[data-streamdown=code-block]]:!my-0 [&_[data-streamdown=code-block]]:!border-0 [&_[data-streamdown=code-block]]:!p-3"
          }
        >
          {highlight ? (
            <Streamdown
              mode="static"
              plugins={{ code: codePlugin }}
              controls={{ code: false }}
              shikiTheme={SHIKI_THEME}
            >
              {markdown}
            </Streamdown>
          ) : (
            <div
              className={
                expanded
                  ? "whitespace-pre p-4 font-mono text-xs leading-5 text-muted-foreground"
                  : "whitespace-pre p-3 font-mono text-xs text-muted-foreground"
              }
            >
              {source}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The code a tool is about to run, in the card's collapsible content so the chevron hides code and output together. */
export function ToolCodeCell({
  label,
  code,
  language,
  downloadName,
  streaming = false,
}: {
  label: string;
  code: string;
  language: string;
  downloadName: string;
  streaming?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="border-l-2 border-muted-foreground/20 pl-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1">
          <CopyBtn text={code} />
          <DownloadBtn code={code} name={downloadName} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("chat.tools.codeViewer.open")}
            title={t("chat.tools.codeViewer.open")}
          >
            <Maximize2Icon className="size-3" />
          </button>
        </div>
      </div>
      <HighlightedCode code={code} language={language} plain={streaming} />
      <CodeViewerModal
        open={open}
        onOpenChange={setOpen}
        title={label}
        language={language}
        actions={
          <>
            <CopyBtn text={code} />
            <DownloadBtn code={code} name={downloadName} />
          </>
        }
      >
        <HighlightedCode code={code} language={language} expanded lineNumbers />
      </CodeViewerModal>
    </div>
  );
}
