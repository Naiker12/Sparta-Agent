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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SecurityWarningIcon,
  ShieldBanIcon,
  SourceCodeSquareIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { severityTone } from "../lib/severity-tone";
import { useRemoteCodeConsentDialogStore } from "../stores/remote-code-consent-dialog-store";
import type {
  RemoteCodeFinding,
  RemoteCodeSeverity,
  RemoteCodeSnippetRow,
  UnsafeFile,
} from "../types";

function matchTone(severity: RemoteCodeSeverity | string): {
  row: string;
  span: string;
} {
  switch (severity) {
    case "CRITICAL":
    case "HIGH":
      return {
        row: "bg-red-500/10 border-l-2 border-red-500/60",
        span: "bg-red-500/25 text-foreground",
      };
    case "MEDIUM":
      return {
        row: "bg-amber-500/10 border-l-2 border-amber-500/60",
        span: "bg-amber-500/25 text-foreground",
      };
    default:
      return {
        row: "bg-muted border-l-2 border-border",
        span: "bg-foreground/15 text-foreground",
      };
  }
}

function SnippetLine({
  row,
  severity,
}: {
  row: RemoteCodeSnippetRow;
  severity: RemoteCodeSeverity;
}) {
  const tone = matchTone(severity);
  const hasSpan =
    row.isMatch &&
    typeof row.matchStart === "number" &&
    typeof row.matchEnd === "number" &&
    row.matchEnd > row.matchStart;

  let body;
  if (hasSpan) {
    const start = row.matchStart as number;
    const end = row.matchEnd as number;
    body = (
      <>
        {row.text.slice(0, start)}
        <span className={cn("rounded-[3px] px-0.5 font-semibold", tone.span)}>
          {row.text.slice(start, end)}
        </span>
        {row.text.slice(end)}
      </>
    );
  } else {
    body = row.text || " ";
  }

  return (
    <div
      className={cn(
        "flex",
        row.isMatch ? tone.row : "border-l-2 border-transparent",
      )}
    >
      <span className="w-10 shrink-0 select-none pr-3 text-right tabular-nums text-muted-foreground/50">
        {row.number}
      </span>
      <code
        className={cn(
          "whitespace-pre pr-3",
          row.isMatch ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {body}
      </code>
    </div>
  );
}

function UnsafeFileCard({ file }: { file: UnsafeFile }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2">
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 text-ui-10 font-semibold uppercase tracking-wide",
          severityTone("CRITICAL"),
        )}
      >
        {file.level}
      </Badge>
      <span className="flex min-w-0 items-center gap-1 font-mono text-xs text-muted-foreground">
        <HugeiconsIcon
          icon={SourceCodeSquareIcon}
          className="size-3.5 shrink-0"
        />
        <span className="truncate">{file.path}</span>
      </span>
    </div>
  );
}

function FindingCard({ finding }: { finding: RemoteCodeFinding }) {
  const fileLabel = finding.line
    ? `${finding.file}:${finding.line}`
    : finding.file;
  const snippet = finding.snippet ?? [];
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-muted/40 px-3 py-2">
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-ui-10 font-semibold tracking-wide",
            severityTone(finding.severity),
          )}
        >
          {finding.severity}
        </Badge>
        <span className="text-sm font-medium">{finding.check}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground">
          <HugeiconsIcon icon={SourceCodeSquareIcon} className="size-3.5" />
          {fileLabel}
        </span>
      </div>
      {snippet.length > 0 ? (
        <div className="min-w-0 overflow-x-auto bg-background py-2 font-mono text-xs leading-relaxed">
          {snippet.map((row) => (
            <SnippetLine
              key={row.number}
              row={row}
              severity={finding.severity}
            />
          ))}
        </div>
      ) : finding.evidence ? (
        <div className="px-3 py-2 font-mono text-xs text-muted-foreground">
          {finding.evidence}
        </div>
      ) : null}
    </div>
  );
}

/** Last path segment of the model id, for display. */
function modelDisplayName(modelName?: string): string {
  if (!modelName) {
    return "This model";
  }
  return modelName.split("/").pop() || modelName;
}

/** ` from "<provider>"` clause, rendered only when a provider was resolved. */
function ProviderSuffix({ provider }: { provider: string | null }) {
  const uiT = useUiT();

  if (!provider) {
    return null;
  }
  return (
    <>
      {" "}
      {uiT("ui.from")}{" "}<span className="font-medium text-foreground">"{provider}"</span>
    </>
  );
}

/** App-wide consent dialog for trust_remote_code loads: shows scan findings with the
 *  flagged code in context; CRITICAL is a hard block. Mounted once in the root layout. */
export function RemoteCodeConsentDialog() {
  const uiT = useUiT();

  const open = useRemoteCodeConsentDialogStore((s) => s.open);
  const scan = useRemoteCodeConsentDialogStore((s) => s.scan);
  const resolve = useRemoteCodeConsentDialogStore((s) => s.resolve);

  const displayName = modelDisplayName(scan?.modelName);
  const provider = scan?.provider ?? null;
  const blocked = scan ? !scan.approvable : false;
  const findings = scan?.findings ?? [];
  const unsafeFiles = scan?.unsafeFiles ?? [];
  // Malware (an HF-flagged unsafe serialized file) is a hard block with its own copy.
  const malware = unsafeFiles.length > 0;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resolve(false);
        }
      }}
    >
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader className="min-w-0">
          {/* w-full: AlertDialogHeader is a grid with place-items-center, which
              otherwise sizes this row to its content and lets a wide code snippet
              push past the dialog. Filling the track keeps everything inside. */}
          <div className="flex w-full min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                blocked
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              )}
            >
              <HugeiconsIcon
                icon={blocked ? ShieldBanIcon : SecurityWarningIcon}
                className="size-5"
              />
            </div>
            {/* Title, description and scan results share one column to the right
                of the icon, so the body aligns under the title instead of jumping
                back to the dialog's left padding. */}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1">
                <AlertDialogTitle>
                  {malware
                    ? uiT("ui.unsafe_files_detected")
                    : blocked
                      ? uiT("ui.custom_code_blocked")
                      : uiT("ui.enable_custom_code_for_this_model")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {malware ? (
                    <>
                      <span className="font-medium text-foreground">
                        {displayName}
                      </span>
                      <ProviderSuffix provider={provider} /> {" "}{uiT("ui.contains_files_that_hugging_face_s_security_scan_flagged_as_unsaf")}</>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">
                        {displayName}
                      </span>
                      <ProviderSuffix provider={provider} /> {" "}{uiT("ui.declares_custom_python_code_in_its_repository")}{" "}
                      {blocked
                        ? uiT("ui.a_security_scan_flagged_critical_issues_so_it_cannot_be_enabled")
                        : findings.length > 0
                          ? uiT("ui.review_the_security_scan_below_continue_only_if_you_trust_the_mod")
                          : uiT("ui.continue_only_if_you_trust_the_model_source")}
                    </>
                  )}
                </AlertDialogDescription>
              </div>

              {malware ? (
                <div className="min-w-0 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {uiT("ui.our_automatic_scanner_flagged_issues_including")}</p>
                  <div className="max-h-[14rem] min-w-0 space-y-2 overflow-y-auto pr-1">
                    {unsafeFiles.map((f, i) => (
                      <UnsafeFileCard key={`${f.path}-${i}`} file={f} />
                    ))}
                  </div>
                </div>
              ) : null}

              {findings.length > 0 ? (
                <div className="min-w-0 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {uiT("ui.our_automatic_scanner_flagged_issues_including")}</p>
                  <div className="max-h-[22rem] min-w-0 space-y-3 overflow-y-auto pr-1">
                    {findings.map((f, i) => (
                      <FindingCard key={i} finding={f} />
                    ))}
                  </div>
                </div>
              ) : null}

              {!(malware || blocked) && findings.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {uiT("ui.our_automatic_scanner_did_not_flag_any_worrying_files_but_please_")}</p>
              ) : null}
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{uiT("chat.workspace.cancel")}</AlertDialogCancel>
          {blocked ? null : (
            <AlertDialogAction onClick={() => resolve(true)}>
              {uiT("ui.enable_and_continue")}</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
