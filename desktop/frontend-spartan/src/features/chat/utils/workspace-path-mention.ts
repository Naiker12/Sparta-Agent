import { workspacePathKey } from "./workspace-path-key";

/** Find Windows paths pasted into a chat message without retaining prose after them. */
export function extractAbsoluteWorkspacePaths(text: string): string[] {
  const matches = text.match(/[A-Za-z]:[\\/][^"'<>|\r\n]*/g) ?? [];
  return matches
    .map((path) => path.split(/[;,]/, 1)[0].replace(/[.!?:)}\]]+$/, "").trim())
    .filter(Boolean);
}

export function pathIsInsideWorkspace(path: string, root?: string): boolean {
  if (!root) return false;
  const candidate = workspacePathKey(path);
  const workspace = workspacePathKey(root);
  return candidate === workspace || candidate.startsWith(`${workspace}/`);
}

export function hasUnconnectedWorkspacePath(text: string, root?: string): boolean {
  return extractAbsoluteWorkspacePaths(text).some(
    (path) => !pathIsInsideWorkspace(path, root),
  );
}
