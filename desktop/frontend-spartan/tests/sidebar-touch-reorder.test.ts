
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Touch never fires dragstart, so the row menu is the only way to reorder a
// list there. A menu behind a trigger without sidebar-touch-reveal is inert on
// coarse pointers, which silently takes manual ordering away from touch users.

async function sidebarSource(): Promise<string> {
  return readFile(
    new URL("../src/components/app-sidebar.tsx", import.meta.url),
    "utf8",
  );
}

/** The className string of the button carrying `label`. */
function actionClassFor(source: string, label: string): string {
  const match = new RegExp(
    `aria-label=\\{t\\([\\s\\S]{0,100}?"${label}"[\\s\\S]{0,100}?className="([^"]*)"`,
  ).exec(source);
  assert.ok(match, `no button renders aria-label="${label}"`);
  return match[1];
}

test("only sidebar-touch-reveal actions work on a coarse pointer", async () => {
  // The rule the rest of this file depends on.
  const css = await readFile(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*?\.sidebar-row-action\.sidebar-touch-reveal\s*\{\s*@apply opacity-100 pointer-events-auto/);
});

test("rows that reorder can open their menu on touch", async () => {
  const source = await sidebarSource();

  // Chat rows, both variants.
  const chatActions = source.match(/"sidebar-row-action[^"]*"/g) ?? [];
  const reorderRowActions = chatActions.filter((cls) =>
    /group-hover\/(recent-item|project-chat-item)/.test(cls),
  );
  assert.ok(reorderRowActions.length > 0, "no chat or project row actions");
  for (const cls of reorderRowActions) {
    assert.match(cls, /sidebar-touch-reveal/);
  }

  // The project folder menu holds the folder reorder controls.
  assert.match(
    actionClassFor(source, "shell.navigation.projectOptions"),
    /sidebar-touch-reveal/,
  );
});

test("a folder row reserves the room its touch actions take", async () => {
  // Revealed without reserved padding, the buttons sit on top of the name.
  const source = await sidebarSource();
  assert.match(source, /group\/recent-item project-folder-row/);
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");
  const row = /\.project-folder-row\s*\{([^}]+)\}/.exec(css);
  assert.ok(row, "could not find the project folder layout");
  assert.match(row[1], /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+24px\s+24px/);
  assert.match(css, /\.project-folder-row \.sidebar-row-action\s*\{\s*@apply static/);
});
