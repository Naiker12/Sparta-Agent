import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { useDocumentPreviewStore } from "../src/features/rag/components/preview-store";

test("closing a local preview releases its document Blob", () => {
	const store = useDocumentPreviewStore;
	const blob = new Blob(["spreadsheet data"]);

	store.getState().openLocalPreview({
		blob,
		filename: "report.xlsx",
		kind: "excel",
	});
	assert.equal(store.getState().localPreview?.blob, blob);

	store.getState().closePreview();
	assert.equal(store.getState().open, false);
	assert.equal(store.getState().localPreview, null);
	assert.equal(store.getState().filename, null);
});

test("spreadsheet preview retains nonempty sheets after an empty default", async () => {
  const XLSX = await import("xlsx");
  const { parseSpreadsheetPreview } = await import("../src/features/rag/components/spreadsheet-preview.worker");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "Sheet");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Project"], ["Sparta"]]), "Projects");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Total"], [27]]), "Summary");
  const result = await parseSpreadsheetPreview(new Blob([XLSX.write(workbook, {type:"array",bookType:"xlsx"})]));
  assert.equal(result.sheets.length, 3);
  assert.equal(result.sheets.find(sheet => sheet.rows.length > 0)?.name, "Projects");
  assert.equal(result.sheets[2].rows[1][0], "27");
});

test("preview mount never leaves the application on an empty lazy fallback", () => {
	const source = readFileSync(
		new URL(
			"../src/features/rag/components/document-preview-mount.tsx",
			import.meta.url,
		),
		"utf8",
	);

	assert.match(source, /class DocumentPreviewLoadBoundary/);
	assert.match(source, /fallback=\{<DocumentPreviewMountState \/>\}/);
	assert.doesNotMatch(source, /<Suspense fallback=\{null\}>/);
});

test("spreadsheet preview bounds rows, columns and cell text", async () => {
  const XLSX = await import("xlsx");
  const { parseSpreadsheetPreview } = await import("../src/features/rag/components/spreadsheet-preview.worker");
  const workbook = XLSX.utils.book_new();
  const rows = Array.from({length: 600}, () => Array.from({length: 70}, () => "value"));
  rows[0][0] = "a".repeat(1500);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Large");
  const result = await parseSpreadsheetPreview(new Blob([XLSX.write(workbook, {type:"array", bookType:"xlsx"})]));
  assert.equal(result.sheets[0].rows.length, 500);
  assert.equal(result.sheets[0].rows[0].length, 64);
  assert.equal(result.sheets[0].rows[0][0].length, 1000);
  assert.equal(result.sheets[0].truncated, true);
});
