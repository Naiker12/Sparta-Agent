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

test("spreadsheet preview skips an empty default worksheet", () => {
	const source = readFileSync(
		new URL(
			"../src/features/rag/components/document-preview-sheet.tsx",
			import.meta.url,
		),
		"utf8",
	);

	assert.match(source, /sheets\.find\(\(\{ rows \}\) => rows\.length > 0\)/);
	assert.doesNotMatch(source, /const name = workbook\.SheetNames\[0\]/);
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
