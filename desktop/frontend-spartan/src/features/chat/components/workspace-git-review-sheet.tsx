import { useCallback, useEffect, useState } from "react";
import { FileCode2Icon, GitBranchIcon, RefreshCwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";
import { getProjectNativeFilesystem } from "../hooks/use-chat-projects";
import type { ProjectRecord } from "../types";

type Change = { path: string; status: string };
type Status = { branch?: string; upstream?: string; insertions?: number; deletions?: number; ahead?: number; behind?: number };
type Operation = { success: boolean; error?: string; output?: string; conflicts: string[] };

function DiffText({ value }: { value: string }) {
  return <pre className="min-w-max p-4 font-mono text-xs leading-5">{value.split("\n").map((line, index) => <span key={index} className={line.startsWith("+") ? "block bg-primary/10 text-primary" : line.startsWith("-") ? "block bg-destructive/10 text-destructive" : line.startsWith("@@") ? "block text-muted-foreground" : "block"}>{line || " "}</span>)}</pre>;
}

function isStaged(change: Change) { return change.status !== "untracked" && change.status[0] !== " "; }

export function WorkspaceGitReviewSheet({ project, open, onOpenChange }: { project: ProjectRecord; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const [changes, setChanges] = useState<Change[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ path: string; value: string } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    const filesystem = getProjectNativeFilesystem();
    const [result, nextStatus, branchResult] = await Promise.all([
      filesystem?.getGitChanges?.(project.id), filesystem?.getGitStatus?.(project.id), filesystem?.getGitBranches?.(project.id),
    ]);
    const next = result?.changes ?? [];
    setChanges(next); setStatus(nextStatus ?? null); setBranches(branchResult?.branches ?? []); setConflicts(result?.conflicts ?? []); setRevision(current => current + 1);
    setSelected(current => next.some(change => change.path === current) ? current : next[0]?.path ?? null);
    setLoading(false);
  }, [project.id]);

  const run = useCallback(async (operation: (() => Promise<Operation | undefined> | undefined)) => {
    setBusy(true); setError(null);
    const result = await operation();
    if (!result?.success) setError(result?.error ?? t("projectsPage.gitOperationFailed"));
    setConflicts(result?.conflicts ?? []);
    await refresh(); setBusy(false);
    return result;
  }, [refresh, t]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [open, refresh]);

  useEffect(() => {
    if (!open || !selected) return;
    let cancelled = false;
    void getProjectNativeFilesystem()?.getGitDiff?.(project.id, selected).then(result => {
      if (!cancelled) setDiff({ path: selected, value: result?.success ? result.diff ?? "" : "" });
    });
    return () => { cancelled = true; };
  }, [open, project.id, revision, selected]);

  const staged = changes.filter(isStaged);
  const editable = project.workspaceAccess === "write";
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-none">
      <SheetHeader className="border-b px-5 py-4 pr-12">
        <SheetTitle className="flex items-center gap-2"><GitBranchIcon data-icon="inline-start" />{t("projectsPage.gitChanges")}</SheetTitle>
        <SheetDescription>{status?.branch ?? "HEAD"}{status?.upstream ? ` → ${status.upstream}` : ""} · +{status?.insertions ?? 0} −{status?.deletions ?? 0}{status?.ahead || status?.behind ? ` · ${t("projectsPage.gitAheadBehind", { ahead: status.ahead ?? 0, behind: status.behind ?? 0 })}` : ""}</SheetDescription>
      </SheetHeader>
      <Tabs defaultValue="changes" className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <TabsList variant="line"><TabsTrigger value="changes">{t("projectsPage.gitChanges")} <Badge variant="secondary">{changes.length}</Badge></TabsTrigger><TabsTrigger value="sync">{t("projectsPage.gitSync")}</TabsTrigger></TabsList>
          <Button className="ml-auto" variant="ghost" size="icon-sm" aria-label={t("projectsPage.gitRefresh")} disabled={loading || busy} onClick={() => void refresh()}><RefreshCwIcon data-icon="inline-start" /></Button>
        </div>
        <TabsContent value="changes" className="m-0 min-h-0 flex-1">
          {error && <p role="alert" className="border-b p-3 text-sm text-destructive">{error}</p>}
          {conflicts.length > 0 && <div className="border-b p-3"><p className="mb-2 text-sm font-medium text-destructive">{t("projectsPage.gitConflicts")}</p>{conflicts.map(path => <div key={path} className="flex items-center gap-2 py-1 text-sm"><span className="min-w-0 flex-1 truncate">{path}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => getProjectNativeFilesystem()?.resolveGitConflict?.(project.id, path, "ours"))}>{t("projectsPage.gitUseOurs")}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => getProjectNativeFilesystem()?.resolveGitConflict?.(project.id, path, "theirs"))}>{t("projectsPage.gitUseTheirs")}</Button></div>)}</div>}
          {!loading && changes.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><FileCode2Icon /></EmptyMedia><EmptyTitle>{t("projectsPage.gitNoChanges")}</EmptyTitle><EmptyDescription>{t("projectsPage.gitReviewEmpty")}</EmptyDescription></EmptyHeader></Empty> :
            <div className="grid h-full min-h-0 grid-cols-[minmax(13rem,0.8fr)_minmax(0,2fr)]">
              <ScrollArea className="border-r"><div className="flex flex-col gap-1 p-2"><Button size="sm" variant="outline" disabled={!editable || busy || changes.length === 0} onClick={() => void run(() => getProjectNativeFilesystem()?.stageGitPaths?.(project.id, changes.map(change => change.path)))}>{t("projectsPage.gitStageAll")}</Button>{changes.map(change => <div key={change.path} className="flex gap-1"><Button variant={selected === change.path ? "secondary" : "ghost"} className="h-auto min-w-0 flex-1 justify-start text-left" onClick={() => setSelected(change.path)}><FileCode2Icon data-icon="inline-start" /><span className="min-w-0 flex-1 truncate">{change.path}</span><Badge variant="outline">{change.status}</Badge></Button><Button size="icon-sm" variant="ghost" aria-label={isStaged(change) ? t("projectsPage.gitUnstage") : t("projectsPage.gitStage")} disabled={!editable || busy} onClick={() => void run(() => isStaged(change) ? getProjectNativeFilesystem()?.unstageGitPaths?.(project.id, [change.path]) : getProjectNativeFilesystem()?.stageGitPaths?.(project.id, [change.path]))}>{isStaged(change) ? "−" : "+"}</Button></div>)}</div></ScrollArea>
              <ScrollArea>{diff?.path !== selected ? <p className="p-5 text-sm text-muted-foreground">{t("chat.preview.loading")}</p> : diff.value ? <DiffText value={diff.value} /> : <Empty><EmptyHeader><EmptyTitle>{t("projectsPage.gitNoDiff")}</EmptyTitle><EmptyDescription>{t("projectsPage.gitNoDiffDescription")}</EmptyDescription></EmptyHeader></Empty>}</ScrollArea>
            </div>}
        </TabsContent>
        <TabsContent value="sync" className="m-0 min-h-0 flex-1"><div className="flex h-full flex-col gap-4 p-5"><div className="flex items-center gap-2"><span className="text-sm font-medium">{t("projectsPage.gitBranch")}</span><Select value={status?.branch ?? ""} onValueChange={branch => void run(() => getProjectNativeFilesystem()?.switchGitBranch?.(project.id, branch))} disabled={!editable || busy}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{branches.map(branch => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}</SelectGroup></SelectContent></Select></div><Textarea value={message} onChange={event => setMessage(event.target.value)} placeholder={t("projectsPage.gitCommitMessage")} disabled={!editable || busy} /><div className="flex flex-wrap gap-2"><Button disabled={!editable || busy || staged.length === 0 || !message.trim()} onClick={() => void run(async () => { const result = await getProjectNativeFilesystem()?.commitGit?.(project.id, message); if (result?.success) setMessage(""); return result; })}>{t("projectsPage.gitCommit")}</Button><Button variant="outline" disabled={!editable || busy || conflicts.length > 0} onClick={() => void run(() => getProjectNativeFilesystem()?.pullGit?.(project.id))}>{t("projectsPage.gitPull")}</Button><Button variant="outline" disabled={!editable || busy || conflicts.length > 0} onClick={() => void run(() => getProjectNativeFilesystem()?.pushGit?.(project.id))}>{t("projectsPage.gitPush")}</Button></div></div></TabsContent>
      </Tabs>
    </SheetContent>
  </Sheet>;
}
