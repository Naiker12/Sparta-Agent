import test from "node:test";
import assert from "node:assert/strict";
import { createResourceFiberRoot, setRootVersion, commitRoot } from "../desktop/frontend-spartan/node_modules/@assistant-ui/tap/dist/core/helpers/root.js";

test("concurrent reducer replay rebases below the committed version without losing later updates", () => {
  const root = createResourceFiberRoot(() => {});
  const cell = { isDirty: false, queue: null, current: "committed", workInProgress: "pending" };
  // Keep unsettled dispatches so the runtime retains committed replay history.
  root.unsettledCount = 5;
  for (let i = 0; i < 4; i++) {
    root.changelog.push({
      fiber: { root }, cell, prevState: `state-${i}`, settled: false,
      queued: false, logged: true, hasEagerState: false,
    });
  }
  setRootVersion(root, 4);
  commitRoot(root);
  let rolledBack = false;
  root.rollbackCallbacks.push(() => { rolledBack = true; });
  assert.doesNotThrow(() => setRootVersion(root, 1));
  assert.equal(root.version, 1);
  assert.equal(root.committedVersion, 1);
  assert.equal(root.changelog.length, 0);
  assert.equal(cell.workInProgress, "state-1");
  assert.equal(root.committedLog.length, 1);
  assert.equal(rolledBack, true);
  setRootVersion(root, 2);
  commitRoot(root);
  assert.equal(root.committedVersion, 2);
});
