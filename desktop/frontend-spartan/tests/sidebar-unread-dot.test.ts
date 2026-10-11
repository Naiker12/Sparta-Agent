
// The dot a finished reply leaves on a sidebar row. Read from the source: the
// node suite has no DOM to mount the sidebar in.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SIDEBAR = readFileSync(
  new URL("../src/components/sidebar/chat-sidebar-item.tsx", import.meta.url),
  "utf8",
);

test("the unread dot is grey", () => {
  assert.match(SIDEBAR, /size-2 rounded-full bg-muted-foreground\/60/);
});

// A literal pair misses the contrast-boost theme, which recomputes
// --muted-foreground rather than swapping light for dark.
test("the unread dot carries no hardcoded light/dark pair", () => {
  assert.doesNotMatch(SIDEBAR, /d07a5f|df8a6f/i);
});

test("unread notifications are not coupled to retired training status", () => {
  assert.doesNotMatch(SIDEBAR, /runStatusDotClass|run\.status/);
  assert.match(SIDEBAR, /hasUnreadActivity/);
});
