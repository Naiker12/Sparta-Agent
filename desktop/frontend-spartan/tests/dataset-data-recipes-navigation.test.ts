import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const text = readFileSync(new URL("../src/features/recipe-studio/executions/tracker.ts", import.meta.url), "utf8");
const trackerFile = ts.createSourceFile("tracker.ts", text, ts.ScriptTarget.Latest, true);
test("successful full recipe runs invalidate the shared dataset inventory", () => {
  const inventoryImport = trackerFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier.getText(trackerFile) === '"@/features/hub"',
  );
  assert.ok(
    inventoryImport,
    "the tracker must import the inventory invalidator",
  );
  assert.match(
    inventoryImport.getText(trackerFile),
    /\bbumpInventoryVersion\b/,
  );

  const fullRunInvalidations: ts.IfStatement[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isIfStatement(node) &&
      node.expression.getText(trackerFile) === 'kind === "full"' &&
      /\bbumpInventoryVersion\s*\(\s*\)/.test(
        node.thenStatement.getText(trackerFile),
      )
    ) {
      fullRunInvalidations.push(node);
    }
    node.forEachChild(visit);
  };
  trackerFile.forEachChild(visit);

  assert.equal(
    fullRunInvalidations.length,
    1,
    "only completed full runs should invalidate the selectable dataset inventory",
  );
});
