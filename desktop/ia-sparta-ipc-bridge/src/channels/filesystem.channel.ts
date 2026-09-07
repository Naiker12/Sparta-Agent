import { ipcMain, dialog, shell } from "electron";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readWorkspacePreview } from "../lib/read-workspace-preview";
import {
  startFileWatcher,
  stopFileWatcher,
  expandWatcher,
  collapseWatcher,
} from "./file-watcher";
import { IGNORED_DIR_SET } from "../lib/filesystem-constants";
import { isWithinRoot } from "../tools/main-process-file-tools";
import {
  isDocumentConvertible,
  convertDocumentToMarkdown,
  getCachedAttachmentContent,
} from "./document.channel";

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

let _workspaceRoot: string | null = null;
let _workspaceAccess: "read" | "write" = "read";
const workspaceRoots = new Map<
  string,
  { root: string; access: "read" | "write" | "write_no_delete" }
>();
const execGit = promisify(execFile);

type WorkspaceGitStatus = {
  isRepository: boolean;
  branch?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  changed?: number;
  added?: number;
  modified?: number;
  deleted?: number;
  untracked?: number;
  insertions?: number;
  deletions?: number;
};

type WorkspaceGitChange = { path: string; status: string };

async function readWorkspaceGitStatus(root: string): Promise<WorkspaceGitStatus> {
  try {
    const { stdout } = await execGit("git", ["-C", root, "--no-optional-locks", "status", "--porcelain=v2", "--branch"], {
      windowsHide: true,
      timeout: 4_000,
      maxBuffer: 512 * 1024,
    });
    const status: WorkspaceGitStatus = { isRepository: true, changed: 0, added: 0, modified: 0, deleted: 0, untracked: 0, ahead: 0, behind: 0, insertions: 0, deletions: 0 };
    for (const line of stdout.split(/\r?\n/)) {
      if (line.startsWith("# branch.head ")) status.branch = line.slice(14);
      else if (line.startsWith("# branch.upstream ")) status.upstream = line.slice(18);
      else if (line.startsWith("# branch.ab ")) {
        const [, ahead = "0", behind = "0"] = line.match(/\+(\d+)\s+-(\d+)/) ?? [];
        status.ahead = Number(ahead); status.behind = Number(behind);
      } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
        status.changed! += 1;
        const xy = line.split(" ")[1] ?? "..";
        if (xy.includes("A")) status.added! += 1;
        if (xy.includes("M")) status.modified! += 1;
        if (xy.includes("D")) status.deleted! += 1;
      } else if (line.startsWith("? ")) { status.changed! += 1; status.untracked! += 1; }
    }
    try {
      const totals = await execGit("git", ["-C", root, "--no-optional-locks", "diff", "--numstat", "HEAD"], {
        windowsHide: true, timeout: 4_000, maxBuffer: 512 * 1024,
      });
      for (const line of totals.stdout.split(/\r?\n/)) {
        const [added, removed] = line.split("\t");
        if (/^\d+$/.test(added)) status.insertions! += Number(added);
        if (/^\d+$/.test(removed)) status.deletions! += Number(removed);
      }
    } catch { /* A repository without HEAD can still report status. */ }
    return status;
  } catch { return { isRepository: false }; }
}

async function readWorkspaceGitChanges(root: string): Promise<WorkspaceGitChange[]> {
  try {
    const { stdout } = await execGit("git", ["-C", root, "--no-optional-locks", "status", "--porcelain=v1", "-z"], {
      windowsHide: true, timeout: 4_000, maxBuffer: 512 * 1024, encoding: "buffer",
    });
    const entries = stdout.toString("utf8").split("\0");
    const changes: WorkspaceGitChange[] = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (!entry) continue;
      const xy = entry.slice(0, 2);
      const file = entry.slice(3);
      if (!/^[ MADRCU?!]{2}$/.test(xy) || !file) continue;
      changes.push({ path: file, status: xy === "??" ? "untracked" : xy });
      if (xy.includes("R") || xy.includes("C")) index += 1;
    }
    return changes;
  } catch { return []; }
}

async function readWorkspaceGitDiff(root: string, relativePath: string): Promise<string> {
  const candidate = path.resolve(root, relativePath);
  if (!relativePath || relativePath.includes("\0") || !isWithinRoot(candidate, root))
    throw new Error("Path is outside workspace root");
  const { stdout } = await execGit("git", ["-C", root, "--no-optional-locks", "diff", "--no-ext-diff", "--no-color", "--unified=3", "HEAD", "--", relativePath], {
    windowsHide: true, timeout: 6_000, maxBuffer: 2 * 1024 * 1024,
  });
  return stdout.slice(0, 2 * 1024 * 1024);
}

async function readWorkspaceGitConflicts(root: string): Promise<string[]> {
  try {
    const { stdout } = await execGit("git", ["-C", root, "--no-optional-locks", "diff", "--name-only", "--diff-filter=U"], { windowsHide: true, timeout: 4_000, maxBuffer: 256 * 1024 });
    return stdout.split(/\r?\n/).filter(Boolean);
  } catch { return []; }
}

async function runWorkspaceGit(root: string, args: string[]): Promise<{ success: true; output: string; conflicts: string[] } | { success: false; error: string; conflicts: string[] }> {
  try {
    const { stdout, stderr } = await execGit("git", ["-C", root, "--no-optional-locks", ...args], { windowsHide: true, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    return { success: true, output: `${stdout}${stderr}`.trim().slice(0, 8_000), conflicts: await readWorkspaceGitConflicts(root) };
  } catch (error) {
    const detail = error as Error & { stderr?: string; stdout?: string };
    return { success: false, error: `${detail.stderr ?? detail.stdout ?? detail.message}`.trim().slice(0, 8_000), conflicts: await readWorkspaceGitConflicts(root) };
  }
}

function workspaceGitWriteError(projectId: string): string | null {
  const workspace = workspaceRoots.get(projectId);
  if (!workspace) return "No workspace folder is connected";
  return assertWorkspaceWrite(projectId, workspace.root);
}

export function getWorkspaceRoot(): string | null {
  return _workspaceRoot;
}

export function getWorkspaceAccess(): "read" | "write" {
  return _workspaceAccess;
}

function assertWorkspacePath(
  projectId: string,
  candidate: string,
): string | null {
  const workspace = workspaceRoots.get(projectId);
  if (!workspace) return "No workspace folder is connected for this project";
  if (!isWithinRoot(candidate, workspace.root))
    return "Path is outside workspace root";
  return null;
}

function assertWorkspaceWrite(
  projectId: string,
  candidate: string,
  isDelete = false,
): string | null {
  const pathError = assertWorkspacePath(projectId, candidate);
  if (pathError) return pathError;
  const access = workspaceRoots.get(projectId)?.access;
  if (access === "read" || !access) return "Workspace is read-only";
  if (isDelete && access === "write_no_delete") return "Workspace does not allow deletion";
  return null;
}

function setWorkspaceRoot(
  projectId: string,
  root: string,
  access: "read" | "write" = "read",
): { success: true } | { success: false; error: string } {
  try {
    if (
      !projectId ||
      typeof projectId !== "string" ||
      !root ||
      typeof root !== "string"
    )
      return { success: false, error: "Invalid project or path" };
    if (access !== "read" && access !== "write")
      return { success: false, error: "Invalid workspace access" };
    const stat = fs.statSync(root);
    if (!stat.isDirectory())
      return { success: false, error: "Workspace root must be a directory" };
    const canonicalRoot = fs.realpathSync(root);
    workspaceRoots.set(projectId, { root: canonicalRoot, access });
    // Legacy main-process tools use the active workspace. Renderer IPC never does.
    _workspaceRoot = canonicalRoot;
    _workspaceAccess = access;
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid workspace root",
    };
  }
}

/** Configure a workspace capability for one chat binding. Unlike the legacy
 * project API this intentionally does not alter `_workspaceRoot` or start a
 * watcher: selecting a folder must be cheap and must not affect another chat.
 */
function setWorkspaceBinding(
  bindingId: string,
  root: string,
  access: "read" | "write" | "write_no_delete" = "read",
): { success: true } | { success: false; error: string } {
  try {
    if (!bindingId || typeof bindingId !== "string" || !root || typeof root !== "string")
      return { success: false, error: "Invalid workspace binding or path" };
    if (!["read", "write", "write_no_delete"].includes(access))
      return { success: false, error: "Invalid workspace access" };
    const stat = fs.statSync(root);
    if (!stat.isDirectory()) return { success: false, error: "Workspace root must be a directory" };
    workspaceRoots.set(bindingId, {
      root: fs.realpathSync(root),
      access,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Invalid workspace root" };
  }
}

export function registerFilesystemIPC() {
  ipcMain.handle("fs:getGitStatus", async (_event, projectId: string) => {
    const workspace = workspaceRoots.get(projectId);
    if (!workspace) return { success: false, error: "No workspace folder is connected" };
    return { success: true, ...(await readWorkspaceGitStatus(workspace.root)) };
  });
  ipcMain.handle("fs:getGitChanges", async (_event, projectId: string) => {
    const workspace = workspaceRoots.get(projectId);
    if (!workspace) return { success: false, error: "No workspace folder is connected", changes: [] };
    const status = await readWorkspaceGitStatus(workspace.root);
    if (!status.isRepository) return { success: true, isRepository: false, changes: [], conflicts: [] };
    return { success: true, isRepository: true, changes: await readWorkspaceGitChanges(workspace.root), conflicts: await readWorkspaceGitConflicts(workspace.root) };
  });
  ipcMain.handle("fs:getGitDiff", async (_event, projectId: string, relativePath: string) => {
    const workspace = workspaceRoots.get(projectId);
    if (!workspace) return { success: false, error: "No workspace folder is connected" };
    try { return { success: true, diff: await readWorkspaceGitDiff(workspace.root, relativePath) }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : "Could not read diff" }; }
  });
  ipcMain.handle("fs:getGitBranches", async (_event, projectId: string) => {
    const workspace = workspaceRoots.get(projectId);
    if (!workspace) return { success: false, error: "No workspace folder is connected", branches: [] };
    try {
      const { stdout } = await execGit("git", ["-C", workspace.root, "branch", "--format=%(refname:short)"], { windowsHide: true, timeout: 4_000, maxBuffer: 256 * 1024 });
      return { success: true, branches: stdout.split(/\r?\n/).filter(Boolean) };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Could not list branches", branches: [] }; }
  });
  ipcMain.handle("fs:switchGitBranch", async (_event, projectId: string, branch: string) => {
    const workspace = workspaceRoots.get(projectId);
    const writeError = workspaceGitWriteError(projectId);
    if (!workspace || writeError) return { success: false, error: writeError ?? "No workspace folder is connected", conflicts: [] };
    if (!branch || /[\0\r\n]/.test(branch)) return { success: false, error: "Invalid branch", conflicts: [] };
    const { stdout } = await execGit("git", ["-C", workspace.root, "branch", "--format=%(refname:short)"], { windowsHide: true, timeout: 4_000, maxBuffer: 256 * 1024 }).catch(() => ({ stdout: "" }));
    if (!stdout.split(/\r?\n/).includes(branch)) return { success: false, error: "Unknown local branch", conflicts: [] };
    return runWorkspaceGit(workspace.root, ["switch", "--", branch]);
  });
  ipcMain.handle("fs:stageGitPaths", async (_event, projectId: string, paths: string[]) => {
    const workspace = workspaceRoots.get(projectId);
    const writeError = workspaceGitWriteError(projectId);
    if (!workspace || writeError) return { success: false, error: writeError ?? "No workspace folder is connected", conflicts: [] };
    const safe = Array.isArray(paths) ? paths.filter(itemPath => typeof itemPath === "string" && !itemPath.includes("\0") && isWithinRoot(path.resolve(workspace.root, itemPath), workspace.root)) : [];
    if (!safe.length) return { success: false, error: "No valid files selected", conflicts: [] };
    return runWorkspaceGit(workspace.root, ["add", "--", ...safe]);
  });
  ipcMain.handle("fs:unstageGitPaths", async (_event, projectId: string, paths: string[]) => {
    const workspace = workspaceRoots.get(projectId);
    const writeError = workspaceGitWriteError(projectId);
    if (!workspace || writeError) return { success: false, error: writeError ?? "No workspace folder is connected", conflicts: [] };
    const safe = Array.isArray(paths) ? paths.filter(itemPath => typeof itemPath === "string" && !itemPath.includes("\0") && isWithinRoot(path.resolve(workspace.root, itemPath), workspace.root)) : [];
    if (!safe.length) return { success: false, error: "No valid files selected", conflicts: [] };
    return runWorkspaceGit(workspace.root, ["restore", "--staged", "--", ...safe]);
  });
  ipcMain.handle("fs:commitGit", async (_event, projectId: string, message: string) => {
    const workspace = workspaceRoots.get(projectId);
    const writeError = workspaceGitWriteError(projectId);
    if (!workspace || writeError) return { success: false, error: writeError ?? "No workspace folder is connected", conflicts: [] };
    if (typeof message !== "string" || !message.trim() || message.length > 5000) return { success: false, error: "A commit message is required", conflicts: [] };
    return runWorkspaceGit(workspace.root, ["commit", "-m", message.trim()]);
  });
  ipcMain.handle("fs:pullGit", async (_event, projectId: string) => {
    const workspace = workspaceRoots.get(projectId);
    const writeError = workspaceGitWriteError(projectId);
    if (!workspace || writeError) return { success: false, error: writeError ?? "No workspace folder is connected", conflicts: [] };
    return runWorkspaceGit(workspace.root, ["pull", "--no-rebase"]);
  });
  ipcMain.handle("fs:pushGit", async (_event, projectId: string) => {
    const workspace = workspaceRoots.get(projectId);
    const writeError = workspaceGitWriteError(projectId);
    if (!workspace || writeError) return { success: false, error: writeError ?? "No workspace folder is connected", conflicts: [] };
    return runWorkspaceGit(workspace.root, ["push"]);
  });
  ipcMain.handle("fs:resolveGitConflict", async (_event, projectId: string, relativePath: string, choice: "ours" | "theirs") => {
    const workspace = workspaceRoots.get(projectId);
    const writeError = workspaceGitWriteError(projectId);
    if (!workspace || writeError) return { success: false, error: writeError ?? "No workspace folder is connected", conflicts: [] };
    if (!relativePath || !["ours", "theirs"].includes(choice) || !isWithinRoot(path.resolve(workspace.root, relativePath), workspace.root)) return { success: false, error: "Invalid conflict resolution", conflicts: [] };
    const resolved = await runWorkspaceGit(workspace.root, ["checkout", `--${choice}`, "--", relativePath]);
    if (!resolved.success) return resolved;
    return runWorkspaceGit(workspace.root, ["add", "--", relativePath]);
  });
  ipcMain.handle("fs:readPreview", async (_event, projectId: string, filePath: string) => {
    const workspace = workspaceRoots.get(projectId);
    if (!workspace || typeof filePath !== "string") return { success: false, error: "No workspace folder is connected" };
    try {
      return { success: true, bytes: await readWorkspacePreview(workspace.root, filePath) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Could not preview file" };
    }
  });
  ipcMain.handle("fs:openFolderDialog", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(
    "fs:confirmWorkspaceAccess",
    async (_event, folderPath: string, locale?: string) => {
      if (!folderPath || typeof folderPath !== "string") return null;
      const spanish = locale?.toLowerCase().startsWith("es") ?? false;
      const result = await dialog.showMessageBox({
        type: "warning",
        title: spanish
          ? "Conectar carpeta de trabajo"
          : "Connect workspace folder",
        message: spanish
          ? "Elige el acceso que Sparta Agent puede tener a esta carpeta."
          : "Choose the access Sparta Agent may have to this folder.",
        detail: spanish
          ? `${folderPath}\n\nUsa una carpeta de trabajo dedicada cuando sea posible. El acceso a esta carpeta no concede permisos de red, conectores ni otras aplicaciones.`
          : `${folderPath}\n\nUse a dedicated work folder when possible. Folder access does not grant network, connector, or other app permissions.`,
        buttons: spanish
          ? ["Solo lectura", "Editar sin eliminar", "Permitir ediciones", "Cancelar"]
          : ["Read only", "Edit without deleting", "Allow edits", "Cancel"],
        defaultId: 0,
        cancelId: 3,
        noLink: true,
      });
      return result.response === 0
        ? "read"
        : result.response === 1
          ? "write_no_delete"
          : result.response === 2
            ? "write"
            : null;
    },
  );

  ipcMain.handle(
    "fs:setWorkspaceBinding",
    async (_event, bindingId: string, root: string, access: "read" | "write" | "write_no_delete" = "read") =>
      setWorkspaceBinding(bindingId, root, access),
  );

  ipcMain.handle("fs:clearWorkspaceBinding", async (_event, bindingId: string) => {
    workspaceRoots.delete(bindingId);
    return { success: true };
  });

  ipcMain.handle(
    "fs:readDirLevel",
    async (_event, projectId: string, dirPath: string) => {
      if (!dirPath || typeof dirPath !== "string")
        return { nodes: [], error: "Invalid path" };
      const pathError = assertWorkspacePath(projectId, dirPath);
      if (pathError) return { nodes: [], error: pathError };
      try {
        let entries: fs.Dirent[] = [];
        try {
          entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
        } catch (err) {
          return { nodes: [], error: (err as Error).message };
        }

        const nodes: FileTreeNode[] = [];
        for (const entry of entries) {
          if (entry.name.startsWith(".") && entry.name !== ".env") continue;
          if (entry.isDirectory() && IGNORED_DIR_SET.has(entry.name)) continue;

          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            nodes.push({
              name: entry.name,
              path: fullPath,
              type: "directory",
              children: [],
            });
          } else if (entry.isFile()) {
            nodes.push({ name: entry.name, path: fullPath, type: "file" });
          }
        }

        nodes.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === "directory" ? -1 : 1;
        });

        return { nodes };
      } catch (err) {
        return { nodes: [], error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    "fs:readFile",
    async (_event, projectId: string, filePath: string, encoding?: string) => {
      if (!filePath || typeof filePath !== "string")
        return { success: false, error: "Invalid path" };
      const pathError = assertWorkspacePath(projectId, filePath);
      if (pathError) return { success: false, error: pathError };

      //  Check chat attachment cache first (e.g. for uploaded PDFs, DOCX, XLSX)
      const cached = getCachedAttachmentContent(filePath);
      if (cached && cached.trim()) {
        return { success: true, content: cached, encoding: "utf-8" };
      }

      //  Convert document if PDF, DOCX, XLSX, etc.
      if (isDocumentConvertible(filePath)) {
        try {
          const conv = await convertDocumentToMarkdown({ filePath });
          if (conv && conv.markdown) {
            return { success: true, content: conv.markdown, encoding: "utf-8" };
          }
        } catch {
          /* ignore fallback to fs */
        }
      }

      try {
        const enc: "utf-8" | "base64" =
          encoding === "base64" ? "base64" : "utf-8";
        const content = fs.readFileSync(filePath, enc);
        return { success: true, content, encoding: enc };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    "fs:writeFile",
    async (_event, projectId: string, filePath: string, content: string) => {
      if (!filePath || typeof filePath !== "string")
        return { success: false, error: "Invalid path" };
      const pathError = assertWorkspaceWrite(projectId, filePath);
      if (pathError) return { success: false, error: pathError };
      try {
        fs.writeFileSync(filePath, content, "utf-8");
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    "fs:deleteFile",
    async (_event, projectId: string, filePath: string) => {
      if (!filePath || typeof filePath !== "string")
        return { success: false, error: "Invalid path" };
      const pathError = assertWorkspaceWrite(projectId, filePath, true);
      if (pathError) return { success: false, error: pathError };
      try {
        await shell.trashItem(filePath);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    "fs:deleteFolder",
    async (_event, projectId: string, folderPath: string) => {
      if (!folderPath || typeof folderPath !== "string")
        return { success: false, error: "Invalid path" };
      const pathError = assertWorkspaceWrite(projectId, folderPath, true);
      if (pathError) return { success: false, error: pathError };
      try {
        await shell.trashItem(folderPath);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    "fs:mkdir",
    async (_event, projectId: string, dirPath: string) => {
      if (!dirPath || typeof dirPath !== "string")
        return { success: false, error: "Invalid path" };
      const pathError = assertWorkspaceWrite(projectId, dirPath);
      if (pathError) return { success: false, error: pathError };
      try {
        await fsPromises.mkdir(dirPath, { recursive: true });
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    "fs:startWatcher",
    async (_event, projectId: string, dirPath: string) => {
      const configured = setWorkspaceRoot(projectId, dirPath);
      if (!configured.success) return configured;
      await startFileWatcher(_workspaceRoot!);
      return configured;
    },
  );

  ipcMain.handle(
    "fs:setWorkspaceRoot",
    async (
      _event,
      projectId: string,
      root: string,
      access: "read" | "write" = "read",
    ) => {
      const configured = setWorkspaceRoot(projectId, root, access);
      if (!configured.success) return configured;
      await startFileWatcher(_workspaceRoot!);
      return configured;
    },
  );

  ipcMain.handle("fs:clearWorkspaceRoot", async (_event, projectId: string) => {
    workspaceRoots.delete(projectId);
    if (workspaceRoots.size === 0) {
      _workspaceRoot = null;
      _workspaceAccess = "read";
      stopFileWatcher();
    }
    return { success: true };
  });

  ipcMain.handle("fs:stopWatcher", () => {
    stopFileWatcher();
    return { success: true };
  });

  ipcMain.handle("fs:expandWatcher", async (_event, dirPath: string) => {
    if (!dirPath || typeof dirPath !== "string") return { success: false };
    await expandWatcher(dirPath);
    return { success: true };
  });

  ipcMain.handle("fs:collapseWatcher", async (_event, dirPath: string) => {
    if (!dirPath || typeof dirPath !== "string") return { success: false };
    collapseWatcher(dirPath);
    return { success: true };
  });

  ipcMain.handle(
    "fs:scanModelWeights",
    async (_event, projectId: string, scanDir: string) => {
      if (!scanDir || typeof scanDir !== "string") {
        return { success: false, error: "Ruta no válida", models: [] };
      }

      const pathError = assertWorkspacePath(projectId, scanDir);
      if (pathError) return { success: false, error: pathError, models: [] };
      try {
        if (!fs.existsSync(scanDir)) {
          return {
            success: false,
            error: `El directorio "${scanDir}" no existe en el equipo`,
            models: [],
          };
        }

        const discovered: Array<{
          name: string;
          path: string;
          size: string;
          sizeBytes: number;
          format: "GGUF" | "Safetensors" | "LoRA" | "PyTorch" | "Checkpoint";
          quantization: string;
          lastModified: string;
        }> = [];

        async function scanRecursive(currentPath: string, depth: number) {
          if (depth > 3) return;
          let entries: fs.Dirent[] = [];
          try {
            entries = await fsPromises.readdir(currentPath, {
              withFileTypes: true,
            });
          } catch {
            return;
          }

          for (const entry of entries) {
            if (entry.name.startsWith(".") || entry.name === "node_modules")
              continue;
            const fullPath = path.join(currentPath, entry.name);

            if (entry.isDirectory()) {
              const isCheckpointDir =
                entry.name.includes("checkpoint") ||
                entry.name.includes("lora") ||
                entry.name.includes("models") ||
                entry.name.includes("output") ||
                entry.name.includes("weights");
              if (isCheckpointDir || depth < 2) {
                await scanRecursive(fullPath, depth + 1);
              }
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              const nameLower = entry.name.toLowerCase();

              if (
                ext === ".gguf" ||
                ext === ".safetensors" ||
                ext === ".bin" ||
                ext === ".pt" ||
                ext === ".onnx"
              ) {
                try {
                  const stat = await fsPromises.stat(fullPath);
                  const sizeGb = (stat.size / (1024 * 1024 * 1024)).toFixed(1);
                  const sizeMb = (stat.size / (1024 * 1024)).toFixed(0);
                  const sizeStr =
                    stat.size >= 1024 * 1024 * 1024
                      ? `${sizeGb} GB`
                      : `${sizeMb} MB`;

                  let format:
                    "GGUF" | "Safetensors" | "LoRA" | "PyTorch" | "Checkpoint" =
                    "GGUF";
                  if (ext === ".safetensors")
                    format = nameLower.includes("adapter")
                      ? "LoRA"
                      : "Safetensors";
                  else if (ext === ".pt" || ext === ".bin") format = "PyTorch";

                  let quant = "Estándar";
                  if (
                    nameLower.includes("q4_k_m") ||
                    nameLower.includes("q4_k")
                  )
                    quant = "Q4_K_M";
                  else if (
                    nameLower.includes("q5_k_m") ||
                    nameLower.includes("q5_k")
                  )
                    quant = "Q5_K_M";
                  else if (
                    nameLower.includes("q8_0") ||
                    nameLower.includes("q8_k")
                  )
                    quant = "Q8_0";
                  else if (nameLower.includes("q4_0")) quant = "Q4_0";
                  else if (nameLower.includes("q4_1")) quant = "Q4_1";
                  else if (
                    nameLower.includes("4bit") ||
                    nameLower.includes("4-bit") ||
                    nameLower.includes("bnb")
                  )
                    quant = "4-bit BnB";
                  else if (
                    nameLower.includes("8bit") ||
                    nameLower.includes("8-bit")
                  )
                    quant = "8-bit";
                  else if (
                    nameLower.includes("f16") ||
                    nameLower.includes("fp16")
                  )
                    quant = "FP16";
                  else if (nameLower.includes("bf16")) quant = "BF16";

                  discovered.push({
                    name: path.basename(entry.name, ext),
                    path: fullPath,
                    size: sizeStr,
                    sizeBytes: stat.size,
                    format,
                    quantization: quant,
                    lastModified: stat.mtime.toISOString(),
                  });
                } catch {
                  /* skip */
                }
              }
            }
          }
        }

        await scanRecursive(scanDir, 0);
        return { success: true, models: discovered };
      } catch (err) {
        return { success: false, error: (err as Error).message, models: [] };
      }
    },
  );
}
