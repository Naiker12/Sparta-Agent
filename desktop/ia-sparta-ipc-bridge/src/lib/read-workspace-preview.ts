import fs from "node:fs/promises";
import path from "node:path";

export const PREVIEW_BYTE_LIMIT = 25 * 1024 * 1024;

/** Read original bytes, never document-to-Markdown conversion, within the granted root. */
export async function readWorkspacePreview(root: string, candidate: string): Promise<Uint8Array> {
  const [base, target] = await Promise.all([fs.realpath(root), fs.realpath(candidate)]);
  const relative = path.relative(base, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Path is outside workspace root");
  const file = await fs.open(target, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error("Preview requires a regular file");
    if (stat.size > PREVIEW_BYTE_LIMIT) throw new Error("Preview limit is 25 MB");
    const buffer = Buffer.alloc(Math.min(stat.size + 1, PREVIEW_BYTE_LIMIT + 1));
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, null);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset > stat.size) throw new Error("File changed while preparing preview; retry");
    return new Uint8Array(buffer.subarray(0, offset));
  } finally {
    await file.close();
  }
}
