import { expect, it } from "vitest";
import { fileLanguage, sourceFence } from "../desktop/frontend-spartan/src/components/workspace-rail/file-source";

it("recognizes code and markdown without assuming unknown formats are executable", () => {
  expect(fileLanguage("D:/work/main.TSX")).toBe("tsx");
  expect(fileLanguage("report.md")).toBe("markdown");
  expect(fileLanguage("data.bin")).toBe("text");
});
it("uses a fence longer than every delimiter inside the file", () => {
  const content = "```\n<script>alert(1)</script>\n````";
  expect(sourceFence(content, "html")).toBe("`````html\n" + content + "\n`````");
});
