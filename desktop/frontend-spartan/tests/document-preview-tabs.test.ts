import assert from "node:assert/strict";
import test from "node:test";
import { useDocumentPreviewStore as store } from "../src/features/rag/components/preview-store";

const preview = (attachmentId: string, filename = "report.docx") => ({
  attachmentId, filename, kind: "word" as const, blob: new Blob([attachmentId]),
});

test("different attachments with identical filenames have independent tabs", () => {
  store.getState().closePreview();
  store.getState().openLocalPreview(preview("a"));
  const first = store.getState().activeTabId!;
  store.getState().openLocalPreview(preview("b"));
  assert.equal(store.getState().tabs.length, 2);
  store.getState().selectTab(first);
  assert.equal(store.getState().localPreview?.attachmentId, "a");
  store.getState().openLocalPreview(preview("a"));
  assert.equal(store.getState().tabs.length, 2, "reopening an attachment must reuse its tab");
  store.getState().closePreview();
});

test("removing an inactive attachment preserves the active document", () => {
  store.getState().openLocalPreview(preview("a"));
  store.getState().openLocalPreview(preview("b"));
  const active = store.getState().activeTabId;
  store.getState().removeAttachmentPreview("a");
  assert.equal(store.getState().tabs.length, 1);
  assert.equal(store.getState().activeTabId, active);
  assert.equal(store.getState().localPreview?.attachmentId, "b");
  store.getState().closePreview();
});

test("removing the active attachment selects another tab; the last closes the panel", () => {
  store.getState().openLocalPreview(preview("a"));
  store.getState().openLocalPreview(preview("b"));
  store.getState().removeAttachmentPreview("b");
  assert.equal(store.getState().localPreview?.attachmentId, "a");
  store.getState().removeAttachmentPreview("a");
  assert.equal(store.getState().open, false);
  assert.equal(store.getState().localPreview, null);
  assert.equal(store.getState().activeTabId, null);
  assert.deepEqual(store.getState().tabs, []);
});

test("closing a tab releases its blob without deleting the attachment", () => {
  const file = preview("a");
  store.getState().openLocalPreview(file);
  const id = store.getState().activeTabId!;
  store.getState().closeTab(id);
  assert.equal(store.getState().localPreview, null);
  assert.equal(store.getState().tabs.length, 0);
  store.getState().openLocalPreview(file);
  assert.equal(store.getState().localPreview?.blob, file.blob);
  store.getState().closePreview();
});

test("workspace tabs deduplicate by project and path, remote documents by ID", () => {
  const file = { ...preview("unused"), attachmentId: undefined, workspaceSource: { projectId: "p", path: "report.docx" } };
  store.getState().openLocalPreview(file);
  store.getState().openLocalPreview({ ...file, blob: new Blob(["updated"]) });
  assert.equal(store.getState().tabs.length, 1);
  store.getState().openPreview({ documentId: "remote", filename: "report.pdf", page: 1 });
  store.getState().openPreview({ documentId: "remote", filename: "report.pdf", page: 3 });
  assert.equal(store.getState().tabs.length, 2);
  assert.equal(store.getState().page, 3);
  store.getState().closePreview();
  assert.equal(store.getState().localPreview, null);
  assert.deepEqual(store.getState().tabs, []);
});
