import { getProjectNativeFilesystem } from "../../hooks/use-chat-projects";
import type { WorkspaceAccess } from "../chat-api";

export type GitReviewMode = "working" | "staged" | "branch";
export interface GitReviewScope {
  id: string;
  root: string;
  access: WorkspaceAccess;
  binding: boolean;
}
export interface GitReviewFile {
  path: string;
  additions: number;
  deletions: number;
  binary: boolean;
}
export interface GitReviewSnapshot {
  success: boolean;
  error?: string;
  repository: string | null;
  files: GitReviewFile[];
  commits: Array<{ id: string; subject: string; author: string; date: string }>;
}
export interface PullRequest {
  number: number;
  title: string;
  state: string;
  url: string;
  headRefName: string;
  baseRefName: string;
}
interface ReviewBridge {
  getGitReview(id: string, mode: GitReviewMode): Promise<GitReviewSnapshot>;
  getGitReviewDiff(
    id: string,
    filename: string,
    mode: GitReviewMode,
  ): Promise<{ success: boolean; error?: string; diff?: string }>;
  getGithubPullRequests(
    id: string,
  ): Promise<{
    success: boolean;
    error?: string;
    repository?: string | null;
    pullRequests?: PullRequest[];
  }>;
}
export function getGitReviewBridge(): ReviewBridge | undefined {
  return (window as Window & { fs?: ReviewBridge }).fs;
}
export async function configureGitReview(scope: GitReviewScope) {
  const fs = getProjectNativeFilesystem();
  // Review should not change the global workspace or start a file watcher.
  const result = await fs?.setWorkspaceBinding?.(
    scope.id,
    scope.root,
    scope.access,
  );
  if (!result?.success)
    throw new Error(result?.error ?? "Workspace unavailable");
  return fs;
}
