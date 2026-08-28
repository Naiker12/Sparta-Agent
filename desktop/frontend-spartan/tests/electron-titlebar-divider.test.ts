import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Electron titlebar overlay has a visible content divider", async () => {
  const provider = await readFile(
    new URL("../src/app/provider.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    provider,
    /function ElectronTitlebarDivider\(\)[\s\S]*?useSidebarPin\(\)[\s\S]*?useSidebarWidth\(\)[\s\S]*?var\(--studio-sidebar-live-width, \$\{width\}px\)[\s\S]*?const contentBorderLeft = pinned \? sidebarWidth : "0px";[\s\S]*?bg-sidebar-border/,
    "the divider must follow the sidebar's live width without adding a visible transition block",
  );
  assert.doesNotMatch(provider, /ElectronTitlebarDivider[\s\S]*?rounded-tl-\[12px\]/);
  assert.match(
    provider,
    /\{isElectron && <ElectronTitlebarDivider \/>\}/,
    "Electron must mount the divider in its active shell branch",
  );
});
