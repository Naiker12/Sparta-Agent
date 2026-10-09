import assert from "node:assert/strict";
import test from "node:test";
import { CompositeAttachmentAdapter } from "@assistant-ui/core";
import {
  DOCX_ATTACHMENT_ACCEPT,
  HTML_ATTACHMENT_ACCEPT,
  PDF_ATTACHMENT_ACCEPT,
  SPREADSHEET_ATTACHMENT_ACCEPT,
} from "../src/features/chat/utils/document-attachment-accept";

function adapter(accept: string, label: string) {
  return {
    accept,
    async add({ file }: { file: File }) {
      return {
        id: label, type: "document" as const, name: file.name, file,
        contentType: file.type,
        status: { type: "requires-action" as const, reason: "composer-send" as const },
      };
    },
    async send(attachment: { id: string; name: string }) {
      return {
        id: attachment.id, name: attachment.name, type: "document" as const,
        content: [{ type: "text" as const, text: label }],
        status: { type: "complete" as const },
      };
    },
    async remove() {},
  };
}

const composite = new CompositeAttachmentAdapter([
  adapter(HTML_ATTACHMENT_ACCEPT, "html"),
  adapter(PDF_ATTACHMENT_ACCEPT, "pdf"),
  adapter(DOCX_ATTACHMENT_ACCEPT, "docx"),
  adapter(SPREADSHEET_ATTACHMENT_ACCEPT, "excel"),
  adapter("text/*,.txt", "text"),
]);

for (const [name, expected] of [["report.PDF", "pdf"], ["report.docx", "docx"], ["page.htm", "html"], ["report.xlsx", "excel"], ["report.XLS", "excel"], ["report.xlsm", "excel"], ["report.xlsb", "excel"]]) {
  for (const type of ["", "application/octet-stream", "text/plain"]) {
    test(`${name} with MIME '${type}' uses the document reader for add and send`, async () => {
      const pending = await composite.add({ file: new File(["fixture"], name, { type }) });
      assert.equal(pending.id, expected);
      const sent = await composite.send(pending);
      assert.deepEqual(sent.content, [{ type: "text", text: expected }]);
    });
  }
}

test("Excel with its real Windows MIME type reaches the spreadsheet reader", async () => {
  const pending = await composite.add({ file: new File(["fixture"], "report.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) });
  assert.equal(pending.id, "excel");
});

test("HTML is handled before generic text and unsupported binaries are rejected", async () => {
  const pending = await composite.add({ file: new File(["<script>bad()</script>"], "page.html", { type: "text/html" }) });
  assert.equal(pending.id, "html");
  assert.throws(() => composite.add({ file: new File(["binary"], "archive.zip") }), /No matching adapter/);
});
