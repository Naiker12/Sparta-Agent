
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The overlay itself is JSX, which cannot be imported here. So: drive the store the
// app-closing events write to, then assert the three call sites read and write it.
import {
  clearAppClosing,
  isAppClosing,
  markAppClosing,
  subscribeAppClosing,
} from "../src/components/tauri/closing-signal.ts";

function source(path: string): Promise<string> {
  return readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
}

/** The ClosingContent body, up to whatever component is declared after it. */
function closingContent(screen: string): string {
  const start = screen.indexOf("function ClosingContent()");
  if (start < 0) {
    throw new Error("ClosingContent is gone");
  }
  return screen.slice(start, screen.indexOf("\nfunction ", start + 1));
}

test("app-closing raises the overlay and app-closing-cancelled clears it", () => {
  const seen: boolean[] = [];
  const unsubscribe = subscribeAppClosing((closing) => seen.push(closing));

  assert.equal(isAppClosing(), false);
  markAppClosing();
  assert.equal(isAppClosing(), true, "a requested quit left the app on screen");
  clearAppClosing();
  assert.equal(isAppClosing(), false, "a declined quit left the overlay up");

  assert.deepEqual(
    seen,
    [true, false],
    "the provider was not told to re-render",
  );
  unsubscribe();
});

test("a re-emitted app-closing does not re-render the overlay", () => {
  const seen: boolean[] = [];
  const unsubscribe = subscribeAppClosing((closing) => seen.push(closing));

  markAppClosing();
  markAppClosing();
  assert.deepEqual(seen, [true]);

  clearAppClosing();
  unsubscribe();
});

test("an unsubscribed listener stops hearing about quits", () => {
  const seen: boolean[] = [];
  subscribeAppClosing((closing) => seen.push(closing))();

  markAppClosing();
  clearAppClosing();
  assert.deepEqual(seen, []);
});

test("the backend hook routes both quit events into the store", async () => {
  const hook = await source("hooks/use-tauri-backend.ts");

  assert.match(
    hook,
    /register<void>\(APP_CLOSING_EVENT,\s*\(\) => \{\s*markAppClosing\(\);/,
    "app-closing no longer raises the overlay",
  );
  assert.match(
    hook,
    /register<void>\(APP_CLOSING_CANCELLED_EVENT,\s*\(\) => \{\s*clearAppClosing\(\);/,
    "a cancelled quit would strand the overlay over a running app",
  );
  // Subscribed, not mirrored into state: the listener lives inside the long event effect,
  // which has no way back to a setState from the render that registered it.
  assert.match(
    hook,
    /const closing = useSyncExternalStore\(subscribeAppClosing, isAppClosing\);/,
  );
  assert.match(
    hook,
    /isExternalServer,\s*closing,/,
    "the hook stopped returning the flag",
  );
});

test("the overlay covers the app instead of replacing it", async () => {
  const provider = await source("app/provider.tsx");

  // Unmounting the app subtree would cancel in-flight generations and drop debounced
  // drafts, and a declined quit has to give all of that back.
  assert.match(provider, /\{shell\}\s*\{closing && <ClosingScreen \/>\}/);
  assert.doesNotMatch(
    provider,
    /closing \? \(/,
    "the overlay is back to replacing the app it should be covering",
  );

  const screen = await source("components/tauri/startup-screen.tsx");
  const closingScreen = screen.slice(
    screen.indexOf("export function ClosingScreen()"),
  );
  assert.match(
    closingScreen,
    /className="[^"]*fixed inset-0 z-\[9999\]"/,
    "a covering overlay has to outrank the titlebar and the download stack",
  );
});

test("the overlay survives a modal's body pointer-events lockout", async () => {
  const screen = await source("components/tauri/startup-screen.tsx");
  const closingScreen = screen.slice(
    screen.indexOf("export function ClosingScreen()"),
  );

  // Radix parks pointer-events:none on <body> for as long as any modal layer is open,
  // and pointer-events inherits. A quit raised from the titlebar controls, the tray or
  // Alt+F4 never closes that layer, so without an explicit auto the overlay is
  // click-through onto the dialog it is hiding, and clicks meant for a screen that says
  // the app is closing land on buttons the user can no longer see.
  assert.match(
    closingScreen,
    /className="pointer-events-auto /,
    "an open dialog would take the clicks aimed at the overlay covering it",
  );
});

test("the close button delegates the quit to the native shell", async () => {
  const titlebar = await source("components/tauri/window-titlebar.tsx");

  // Raising it here would put it behind the quit confirmations, one of which asks whether
  // to keep training. Rust raises it only once those have passed.
  assert.doesNotMatch(
    titlebar,
    /markAppClosing/,
    "the close button is raising the overlay before the quit is committed",
  );
  assert.match(titlebar, /onClick=\{\(\) => runWindowAction\(\(appWindow\) =>\s*appWindow\.close\(\)\)\}/);
});

test("the overlay is presentation only, with no way out of a wedged reap", async () => {
  const signal = await source("components/tauri/closing-signal.ts");
  const screen = await source("components/tauri/startup-screen.tsx");
  const body = closingContent(screen);

  // A wedged teardown has no escape, and did not have one before this overlay either: a
  // second close press, Alt+F4 and the taskbar all land on request_quit, which begin_quit
  // has already turned into a silent no-op for the life of the reap. The overlay does not
  // take an escape away, it explains the freeze that was already there.
  assert.doesNotMatch(
    signal,
    /force_quit|forceQuit/,
    "a force quit command is process management this overlay does not need",
  );
  assert.doesNotMatch(body, /Force quit/);
  // No timer either: nothing in the overlay changes with time, so nothing may schedule
  // work that outlives a declined quit.
  assert.doesNotMatch(body, /setTimeout|useState/);
});

test("Electron stops its backend on quit even after the last window closes", async () => {
  const main = await readFile(new URL("../../ia-sparta-app-shell/src/electron-main.ts", import.meta.url), "utf8");
  assert.match(main, /app\.on\('before-quit', \(\) => backend\.stop\(\)\)/);
  assert.match(main, /app\.on\('window-all-closed',[\s\S]*?app\.quit\(\)/);
  assert.match(main, /win\.on\('closed', \(\) => \{\s*win = null/);
});

test("the overlay names the wait it is covering", async () => {
  const screen = await source("components/tauri/startup-screen.tsx");
  const body = closingContent(screen);

  assert.match(body, /shell\.startup\.closing/);
  assert.match(body, /shell\.startup\.shuttingDown/);
  // A still screen reads as the freeze it is there to explain.
  assert.match(body, /<Spinner className="size-6 text-primary" \/>/);
});

test("Electron preload and main agree on the close channel", async () => {
  const main = await readFile(new URL("../../ia-sparta-app-shell/src/electron-main.ts", import.meta.url), "utf8");
  const preload = await readFile(new URL("../../ia-sparta-ipc-bridge/src/electron-preload.ts", import.meta.url), "utf8");
  assert.match(preload, /close: \(\) => ipcRenderer\.send\("win:close"\)/);
  assert.match(main, /ipcMain\.on\('win:close', \(\) => win\?\.close\(\)\)/);
});
