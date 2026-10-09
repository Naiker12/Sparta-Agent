import assert from "node:assert/strict";
import test from "node:test";
import { CompositeAttachmentAdapter } from "@assistant-ui/core";
import * as XLSX from "xlsx";
import { SpreadsheetAttachmentAdapter, spreadsheetAttachmentText } from "../src/features/chat/spreadsheet-attachment-adapter";
import { parseSpreadsheetPreview } from "../src/features/rag/components/spreadsheet-preview.worker";

for (const bookType of ["xlsx", "xls", "xlsm", "xlsb"] as const) {
  test(`${bookType} routes to the real spreadsheet reader and includes all sheets`, async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "Empty");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Concepto", "Valor"], ["Spartan", 42]]), "Data");
    const file = new File([XLSX.write(workbook, { type: "array", bookType })], `report.${bookType}`, {
      type: bookType === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/octet-stream",
    });
    const adapter = new CompositeAttachmentAdapter([
      new SpreadsheetAttachmentAdapter(async blob => spreadsheetAttachmentText(await parseSpreadsheetPreview(blob))),
    ]);
    const pending = await adapter.add({ file });
    const sent = await adapter.send(pending);
    assert.equal(sent.name, file.name);
    assert.equal(sent.id, pending.id);
    assert.deepEqual(sent.status, { type: "complete" });
    assert.equal(sent.content[0].type, "text");
    if (sent.content[0].type === "text") {
      assert.match(sent.content[0].text, /\[Sheet: Empty\]/);
      assert.match(sent.content[0].text, /\[Sheet: Data\]/);
      assert.match(sent.content[0].text, /Spartan\t42/);
    }
  });
}
