import assert from "node:assert/strict";
import test from "node:test";
import { getAppLocation, appNavigationHref, reloadAppAt } from "../src/lib/app-location.ts";

test("a cold file window starts at the application root, not its disk pathname", () => {
  assert.equal(getAppLocation(new URL("file:///C:/Program%20Files/Spartan/resources/app.asar/dist/index.html")).pathname, "/");
});
test("file routes retain the selected thread, project and document anchor", () => {
  const location = getAppLocation(new URL("file:///C:/app/dist/index.html#/chat?thread=A%20B&project=p1#document"));
  assert.equal(location.pathname, "/chat");
  assert.equal(location.searchParams.get("thread"), "A B");
  assert.equal(location.searchParams.get("project"), "p1");
  assert.equal(location.hash, "#document");
});
test("HTTP routes keep ordinary browser path, query and anchor semantics", () => {
  const location = getAppLocation(new URL("http://localhost:5173/chat?thread=A#document"));
  assert.equal(location.pathname + location.search + location.hash, "/chat?thread=A#document");
  assert.equal(appNavigationHref("/login", new URL("http://localhost:5173/chat") as unknown as Location), "/login");
});
test("auth redirects preserve the installed document in paths containing spaces", () => {
  const current = new URL("file:///C:/Program%20Files/Spartan/resources/app.asar/dist/index.html#/chat?thread=A");
  const target = new URL(appNavigationHref("/change-password", current as unknown as Location));
  assert.equal(target.pathname, current.pathname);
  assert.equal(target.hash, "#/change-password");
  assert.equal(getAppLocation(target).pathname, "/change-password");
});

test("file authentication redirects preserve the cold-reload session boundary", () => {
  let reloads = 0;
  const location = {
    protocol: "file:", href: "file:///C:/Spartan/app.asar/dist/index.html#/chat",
    reload: () => { reloads += 1; },
  } as unknown as Location;
  reloadAppAt("/login", location);
  assert.equal(location.href, "file:///C:/Spartan/app.asar/dist/index.html#/login");
  assert.equal(reloads, 1);
});
