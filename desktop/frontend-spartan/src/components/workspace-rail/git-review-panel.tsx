import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n";
import { RefreshCw, GitBranch, ExternalLink } from "lucide-react";
import {
  configureGitReview,
  getGitReviewBridge,
  type GitReviewMode,
  type GitReviewSnapshot,
  type GitReviewFile,
  type PullRequest,
} from "@/features/chat/api/modules/workspace-git-api";
import type { RepositoryPreview } from "@/features/rag/components/preview-store";
import type { WorkspaceChangedFile } from "@/features/chat/stores/use-workspace-store";
import { DiffViewer } from "./diff-viewer";

function ReviewFile({
  item,
  preview,
  mode,
}: { item: GitReviewFile; preview: RepositoryPreview; mode: GitReviewMode }) {
  const t = useT();
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [file, setFile] = useState<WorkspaceChangedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const bridge = getGitReviewBridge();
    if (!bridge) {
      setError(t("chat.repository.restart"));
      return;
    }
    void bridge
      .getGitReviewDiff(preview.scope.id, item.path, mode)
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setError(result.error ?? t("chat.repository.loadFailed"));
          return;
        }
        setFile({
          path: item.path,
          filename: item.path.split("/").at(-1)!,
          status: "modified",
          additions: item.additions,
          deletions: item.deletions,
          diff: result.diff ?? "",
        });
      })
      .catch((reason) => !cancelled && setError(String(reason)));
    return () => {
      cancelled = true;
    };
  }, [visible, item, preview.scope.id, mode, t]);
  return (
    <div ref={element} className="min-h-24 border-b">
      {file ? (
        <DiffViewer file={file} />
      ) : (
        <div className="flex items-center gap-2 p-3 text-sm">
          <span className="min-w-0 flex-1 break-all">{item.path}</span>
          {error ? (
            <span role="alert" className="text-destructive">
              {error}
            </span>
          ) : (
            <Spinner />
          )}
        </div>
      )}
    </div>
  );
}

export function GitReviewPanel({ preview }: { preview: RepositoryPreview }) {
  const t = useT();
  const [mode, setMode] = useState<GitReviewMode>("working");
  const [snapshot, setSnapshot] = useState<GitReviewSnapshot | null>(null);
  const [status, setStatus] = useState<{
    branch?: string;
    upstream?: string;
  } | null>(null);
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSnapshot(null);
    setPrs([]);
    setStatus(null);
    void (async () => {
      const fs = await configureGitReview(preview.scope);
      const nextStatus = await fs?.getGitStatus?.(preview.scope.id);
      if (!nextStatus?.success) throw new Error(nextStatus?.error);
      if (!nextStatus.isRepository)
        throw new Error(t("chat.repository.notRepository"));
      if (!cancelled) setStatus(nextStatus);
      const bridge = getGitReviewBridge();
      if (!bridge?.getGitReview) throw new Error(t("chat.repository.restart"));
      const next = await bridge.getGitReview(preview.scope.id, mode);
      if (!next.success)
        throw new Error(
          mode === "branch" ? t("chat.repository.noUpstream") : next.error,
        );
      if (cancelled) return;
      setSnapshot(next);
      if (preview.kind === "github") {
        const result = await bridge.getGithubPullRequests(preview.scope.id);
        if (!result.success)
          throw new Error(t("chat.repository.githubUnavailable"));
        if (!cancelled) setPrs(result.pullRequests ?? []);
      }
    })()
      .catch(
        (reason) =>
          !cancelled &&
          setError(reason instanceof Error ? reason.message : String(reason)),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [
    preview.scope.id,
    preview.scope.root,
    preview.scope.access,
    preview.scope.binding,
    preview.kind,
    mode,
    revision,
    t,
  ]);
  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label={t("chat.repository.changes")}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        {preview.kind === "changes" && (
          <div className="flex items-center gap-2 rounded-full bg-muted px-2">
            <Select
              value={mode}
              onValueChange={(value) => setMode(value as GitReviewMode)}
            >
              <SelectTrigger className="w-auto border-0 bg-transparent shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(["working", "staged", "branch"] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`chat.repository.${value}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {snapshot && (
              <span className="whitespace-nowrap pr-2 text-xs font-mono">
                <span className="text-green-600">
                  +
                  {snapshot.files.reduce(
                    (sum, item) => sum + item.additions,
                    0,
                  )}
                </span>{" "}
                <span className="text-red-600">
                  −
                  {snapshot.files.reduce(
                    (sum, item) => sum + item.deletions,
                    0,
                  )}
                </span>
              </span>
            )}
          </div>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={!status?.upstream || preview.kind !== "changes"}
          onClick={() => setMode("branch")}
        >
          <GitBranch />
          {status?.branch ?? "—"}
          {status?.upstream ? ` → ${status.upstream}` : ""}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={loading}
          aria-label={t("chat.repository.refresh")}
          onClick={refresh}
        >
          <RefreshCw />
        </Button>
      </div>
      {loading && (
        <div role="status" className="flex items-center gap-2 p-4 text-sm">
          <Spinner />
          {t("chat.repository.loading")}
        </div>
      )}
      {error && (
        <p role="alert" className="p-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {!loading && !error && preview.kind === "github" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          <p className="text-sm font-medium">
            {snapshot?.repository ?? t("chat.repository.noGithub")}
          </p>
          {snapshot?.repository && !prs.length && (
            <p className="text-sm text-muted-foreground">
              {t("chat.repository.noPullRequests")}
            </p>
          )}
          {prs.map((pr) => (
            <a
              key={pr.number}
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border p-3 text-sm"
            >
              <span className="flex items-center justify-between gap-2">
                #{pr.number} {pr.title}
                <ExternalLink className="size-4 shrink-0" />
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {t(
                  `chat.repository.pr${pr.state === "MERGED" ? "Merged" : pr.state === "CLOSED" ? "Closed" : "Open"}`,
                )}{" "}
                · {pr.headRefName} → {pr.baseRefName}
              </span>
            </a>
          ))}
          <p className="text-sm font-medium">{t("chat.repository.history")}</p>
          {snapshot?.commits.map((commit) => (
            <div key={commit.id} className="rounded-lg border p-3 text-xs">
              <p>{commit.subject}</p>
              <p className="mt-1 text-muted-foreground">
                {commit.id} · {commit.author} ·{" "}
                {new Date(commit.date).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
      {!loading && !error && preview.kind === "changes" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          {!snapshot?.files.length ? (
            <p className="text-sm text-muted-foreground">
              {t("chat.repository.clean")}
            </p>
          ) : (
            snapshot.files.map((item) => (
              <ReviewFile
                key={`${mode}:${revision}:${item.path}`}
                item={item}
                preview={preview}
                mode={mode}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
