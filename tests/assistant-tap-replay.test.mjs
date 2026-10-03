import test from "node:test";
import assert from "node:assert/strict";
import { createResourceFiberRoot, setRootVersion, commitRoot } from "../desktop/frontend-spartan/node_modules/@assistant-ui/tap/dist/core/helpers/root.js";

test("concurrent reducer replay rebases below the committed version without losing later updates", () => {
  const root = createResourceFiberRoot(() => {});
  setRootVersion(root, 4);
  commitRoot(root);
  let rolledBack = false;
  root.dirtyCells.push({dirty:true, queue:new Map(), current:"committed", workInProgress:"pending"});
  root.changelog.push(() => { rolledBack = true; });
  assert.doesNotThrow(() => setRootVersion(root, 1));
  assert.equal(root.version, 1);
  assert.equal(root.committedVersion, 1);
  assert.equal(root.changelog.length, 0);
  assert.equal(root.dirtyCells.length, 0);
  assert.equal(rolledBack, false);
  setRootVersion(root, 2);
  commitRoot(root);
  assert.equal(root.committedVersion, 2);
});
