import { afterEach, expect, test } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PREVIEW_BYTE_LIMIT, readWorkspacePreview } from "../desktop/ia-sparta-ipc-bridge/src/lib/read-workspace-preview";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, {recursive:true,force:true}); });
async function fixture() { const root = await fs.mkdtemp(path.join(os.tmpdir(), "sparta-preview-test-")); roots.push(root); await fs.mkdir(path.join(root,"workspace")); return root; }
test("returns original binary bytes inside the connected workspace", async () => {
  const root = await fixture(); const file = path.join(root,"workspace","report.xlsx");
  const bytes = new Uint8Array([0,255,80,75,10]); await fs.writeFile(file,bytes);
  expect(await readWorkspacePreview(path.join(root,"workspace"),file)).toEqual(bytes);
});
test("rejects a sibling path with the same prefix", async () => {
  const root = await fixture(); await fs.mkdir(path.join(root,"workspace-other")); const file=path.join(root,"workspace-other","private.txt"); await fs.writeFile(file,"private");
  await expect(readWorkspacePreview(path.join(root,"workspace"),file)).rejects.toThrow("outside");
});
test("rejects directories and oversized files before reading them", async () => {
  const root = await fixture(); const folder=path.join(root,"workspace");
  await expect(readWorkspacePreview(folder,folder)).rejects.toThrow("regular file");
  const file=path.join(folder,"large.bin"); const handle=await fs.open(file,"w"); await handle.truncate(PREVIEW_BYTE_LIMIT+1); await handle.close();
  await expect(readWorkspacePreview(folder,file)).rejects.toThrow("25 MB");
});
test("rejects a junction leading outside the workspace", async () => {
  const root = await fixture(); const outside=path.join(root,"outside"); await fs.mkdir(outside); await fs.writeFile(path.join(outside,"private.txt"),"private");
  const folder=path.join(root,"workspace"); await fs.symlink(outside,path.join(folder,"link"),process.platform === "win32" ? "junction" : "dir");
  await expect(readWorkspacePreview(folder,path.join(folder,"link","private.txt"))).rejects.toThrow("outside");
});
