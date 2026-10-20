import assert from "node:assert/strict";
import test from "node:test";
import { hasSeenTour, rememberTour } from "../src/features/tour/lib/tour-history.ts";

test("tour is remembered as soon as shown, independently of finishing it", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }});
  assert.equal(hasSeenTour("first-visit-test"), false);
  rememberTour("first-visit-test", "shown");
  assert.equal(hasSeenTour("first-visit-test"), true);
  assert.equal(values.get("first-visit-test"), "shown");
  rememberTour("first-visit-test", "done");
  assert.equal(values.get("first-visit-test"), "done");
});

test("unavailable browser storage does not break the tour or repeatedly open it", () => {
  Object.defineProperty(globalThis, "localStorage", {configurable: true, get() {throw new Error("Storage disabled");}});
  assert.equal(hasSeenTour("blocked-storage-test"), false);
  rememberTour("blocked-storage-test", "skipped");
  assert.equal(hasSeenTour("blocked-storage-test"), true);
});
