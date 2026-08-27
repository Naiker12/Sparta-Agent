import assert from "node:assert/strict";
import test from "node:test";
import {
  getAttachmentFileKind,
  getAttachmentIcon,
  KIND_ICON_MAP,
} from "../src/lib/attachment-file-kind";

test("getAttachmentFileKind identifies file kind by extension", () => {
  // PDF
  assert.equal(getAttachmentFileKind("report.pdf"), "pdf");
  assert.equal(getAttachmentFileKind("UPPERCASE.PDF"), "pdf");

  // Word
  assert.equal(getAttachmentFileKind("document.docx"), "word");
  assert.equal(getAttachmentFileKind("old.doc"), "word");
  assert.equal(getAttachmentFileKind("open.odt"), "word");

  // Excel
  assert.equal(getAttachmentFileKind("finances.xlsx"), "excel");
  assert.equal(getAttachmentFileKind("sheet.xls"), "excel");
  assert.equal(getAttachmentFileKind("data.ods"), "excel");

  // CSV
  assert.equal(getAttachmentFileKind("records.csv"), "csv");
  assert.equal(getAttachmentFileKind("tab.tsv"), "csv");

  // PowerPoint
  assert.equal(getAttachmentFileKind("presentation.pptx"), "powerpoint");
  assert.equal(getAttachmentFileKind("slides.ppt"), "powerpoint");

  // Images
  assert.equal(getAttachmentFileKind("photo.png"), "image");
  assert.equal(getAttachmentFileKind("avatar.jpg"), "image");
  assert.equal(getAttachmentFileKind("vector.svg"), "image");

  // Video
  assert.equal(getAttachmentFileKind("clip.mp4"), "video");
  assert.equal(getAttachmentFileKind("stream.webm"), "video");

  // Audio
  assert.equal(getAttachmentFileKind("song.mp3"), "audio");
  assert.equal(getAttachmentFileKind("voice.wav"), "audio");

  // Code
  assert.equal(getAttachmentFileKind("app.tsx"), "code");
  assert.equal(getAttachmentFileKind("server.py"), "code");
  assert.equal(getAttachmentFileKind("query.sql"), "code");
  assert.equal(getAttachmentFileKind("package.json"), "code");

  // Archives
  assert.equal(getAttachmentFileKind("backup.zip"), "archive");
  assert.equal(getAttachmentFileKind("archive.tar.gz"), "archive");

  // Text
  assert.equal(getAttachmentFileKind("notes.txt"), "text");
  assert.equal(getAttachmentFileKind("README.md"), "text");

  // Unknown
  assert.equal(getAttachmentFileKind("binary.xyz"), "unknown");
});

test("getAttachmentFileKind falls back to contentType when extension is absent", () => {
  assert.equal(getAttachmentFileKind("blob", "application/pdf"), "pdf");
  assert.equal(getAttachmentFileKind(null, "text/csv"), "csv");
  assert.equal(getAttachmentFileKind(undefined, "image/jpeg"), "image");
  assert.equal(getAttachmentFileKind("", "audio/mpeg"), "audio");
  assert.equal(getAttachmentFileKind(null, "video/mp4"), "video");
});

test("getAttachmentIcon returns matching Hugeicons SVG object", () => {
  assert.equal(getAttachmentIcon("test.pdf"), KIND_ICON_MAP.pdf);
  assert.equal(getAttachmentIcon("sheet.xlsx"), KIND_ICON_MAP.excel);
  assert.equal(getAttachmentIcon("data.csv"), KIND_ICON_MAP.csv);
  assert.equal(getAttachmentIcon("word.docx"), KIND_ICON_MAP.word);
  assert.equal(getAttachmentIcon("unknown.bin"), KIND_ICON_MAP.unknown);
});
