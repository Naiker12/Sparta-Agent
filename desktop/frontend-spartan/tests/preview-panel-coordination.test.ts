import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { useChatArtifactsStore as artifacts } from "../src/features/chat/artifacts/store.ts";
import { useWorkspaceStore as workspace } from "../src/features/chat/stores/use-workspace-store.ts";
import { createChatArtifact } from "../src/features/chat/artifacts/types.ts";
import { readFileSync } from "node:fs";

const artifact = () => createChatArtifact({ source: "fence", threadId: "chat", code: "<h1>Preview</h1>" });
beforeEach(() => {
  artifacts.getState().resetArtifacts();
  workspace.setState(workspace.getInitialState(), true);
});

test("opening a canvas closes the browser for every artifact entry point", () => {
  workspace.getState().navigateBrowser("https://example.test");
  artifacts.getState().openArtifact(artifact());
  assert.equal(workspace.getState().isOpen, false);
  assert.ok(artifacts.getState().selectedArtifactId);
  assert.equal(workspace.getState().browserUrl, "https://example.test");
});

test("opening the browser closes the canvas without deleting its content", () => {
  const canvas = artifact();
  artifacts.getState().openArtifact(canvas);
  workspace.getState().navigateBrowser("https://example.test");
  assert.equal(artifacts.getState().selectedArtifactId, null);
  assert.equal(artifacts.getState().artifactsById[canvas.id].code, canvas.code);
  assert.equal(workspace.getState().isOpen, true);
});

for (const action of ["openTab", "setActiveTab", "setOpen", "toggleOpen"] as const) {
  test(`${action} cannot reopen a second browser beside the canvas`, () => {
    workspace.setState({ activeTab: "browser", isOpen: false });
    artifacts.getState().openArtifact(artifact());
    if (action === "openTab" || action === "setActiveTab") workspace.getState()[action]("browser");
    else if (action === "setOpen") workspace.getState().setOpen(true);
    else workspace.getState().toggleOpen();
    assert.equal(artifacts.getState().selectedArtifactId, null);
    assert.equal(workspace.getState().isOpen, true);
  });
}

test("opening a canvas preserves the project file explorer", () => {
  workspace.getState().openTab("files");
  artifacts.getState().openArtifact(artifact());
  assert.equal(workspace.getState().isOpen, true);
  assert.equal(workspace.getState().activeTab, "files");
});

test("the browser starts empty instead of opening an unrelated localhost page", () => {
  assert.equal(workspace.getState().browserUrl, "");
  assert.deepEqual(workspace.getState().browserHistory, []);
  workspace.getState().navigateBrowser("https://example.test");
  assert.equal(workspace.getState().browserHistoryIndex, 0);
});

test("the application shell never redirects a selected HTML artifact to a fabricated server", () => {
  const provider = readFileSync(new URL("../src/app/provider.tsx", import.meta.url), "utf8");
  const relay = readFileSync(new URL("../src/features/chat/hooks/use-workspace-relay.ts", import.meta.url), "utf8");
  assert.ok(!provider.includes("useWorkspaceRelay"));
  assert.ok(!relay.includes("localhost:4200"));
  assert.ok(!relay.includes("selectedArtifactId"));
});
