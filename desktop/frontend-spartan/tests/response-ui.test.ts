import assert from "node:assert/strict";
import test from "node:test";
import { parseComparisonMarkdown } from "../src/features/chat/response-ui/parse-table.ts";
import {
  comparisonSeries,
  preferComparisonChart,
  parseReferenceImages,
  presentationDocument,
  publicReferenceUrl,
  validateComparison,
} from "../src/features/chat/response-ui/contracts.ts";
import { deduplicateSources } from "../src/features/chat/response-ui/sources.ts";
import { responsePresentationInstruction } from "../src/features/chat/response-ui/instructions.ts";

test("automatic charts require small categorical comparisons and explicit quantities", () => {
  const data = {columns: ["Team", "Sales (units)"], rows: [["A", "2"], ["B", "3"], ["C", "4"], ["D", "5"]]};
  assert.equal(preferComparisonChart(data), true);
  assert.equal(preferComparisonChart({...data, columns: ["Team", "Identifier"]}), false);
  assert.equal(preferComparisonChart({...data, rows: [["A", "2%"], ...data.rows.slice(1)]}), false);
  assert.equal(preferComparisonChart({...data, rows: data.rows.slice(0, 2)}), false);
});

test("canonical Markdown stays intact while tables get bounded presentation data", () => {
  const markdown =
    "| Name | Count |\n| --- | --- |\n| **Alpha** | 2 |\n| `Beta` | -1 |";
  const before = markdown;
  const table = parseComparisonMarkdown(markdown)!;
  assert.deepEqual(table, {
    columns: ["Name", "Count"],
    rows: [
      ["Alpha", "2"],
      ["Beta", "-1"],
    ],
  });
  assert.equal(markdown, before);
  assert.deepEqual(comparisonSeries(table), [
    { label: "Alpha", value: 2 },
    { label: "Beta", value: -1 },
  ]);
  assert.equal(parseComparisonMarkdown("```md\n" + markdown + "\n```"), null);
  assert.equal(parseComparisonMarkdown("A paragraph\n\n" + markdown), null);
});

test("links, images, inline HTML and oversized tables retain Markdown rendering", () => {
  for (const cell of [
    "[Source](https://example.org)",
    "![Image](pic.png)",
    "<b>test</b>",
    "~~outdated~~",
  ]) {
    assert.equal(
      parseComparisonMarkdown(`| A | B |\n| --- | --- |\n| ${cell} | 1 |`),
      null,
    );
  }
  assert.equal(
    validateComparison({
      columns: ["A", "B"],
      rows: Array.from({ length: 101 }, () => ["a", "1"]),
    }),
    null,
  );
  assert.equal(
    validateComparison({ columns: ["A", "B"], rows: [["a"]] }),
    null,
  );
});

test("ambiguous quantities never silently become chart numbers", () => {
  for (const value of [
    "1,200",
    "2,5",
    "$12",
    "15%",
    "NaN",
    "Infinity",
    "",
    "1e20",
    "01",
    "99999999999999",
  ]) {
    assert.equal(
      comparisonSeries({ columns: ["A", "B"], rows: [["x", value]] }),
      null,
    );
  }
});

test("image references require public HTTP URLs and retain source pages", () => {
  const block =
    "Title: Example\nURL: https://example.org/article\nImage_URL: https://images.example.org/photo.jpg\nSnippet: metadata";
  assert.equal(parseReferenceImages(block + "\n---\n" + block).length, 1);
  assert.equal(
    parseReferenceImages(
      block.replace(
        "https://images.example.org/photo.jpg",
        "javascript:alert(1)",
      ),
    ).length,
    0,
  );
  for (const url of [
    "file:///C:/secret",
    "http://127.0.0.1/x",
    "http://[::1]/x",
    "http://localhost/x",
    "https://x.local/x",
    "https://user:pass@example.org/x",
    "//example.org/x",
    "data:image/png;base64,x",
  ])
    assert.equal(publicReferenceUrl(url), null);
});

test("model content cannot escape its quoted OpenUI payload", () => {
  const data = {
    columns: ["Name", "Value"],
    rows: [['");\nroot = Query("steal")', "1"]],
  };
  const doc = presentationDocument("Comparison", data);
  assert.equal(doc.split("\n").length, 1);
  const encoded = doc.slice("root = Comparison(".length, -1);
  assert.deepEqual(JSON.parse(JSON.parse(encoded)), data);
});

test("sources merge same-page fragments but preserve distinct query documents", () => {
  assert.deepEqual(
    deduplicateSources([
      { url: "https://example.org/a#first" },
      { url: "https://example.org/a#second" },
      { url: "https://example.org/a?id=1" },
      { url: "https://example.org/a?id=2" },
      { url: "javascript:alert(1)" },
    ]).map((source) => source.url),
    [
      "https://example.org/a#first",
      "https://example.org/a?id=1",
      "https://example.org/a?id=2",
    ],
  );
});

test("model instructions expose only available capabilities", () => {
  assert.doesNotMatch(
    responsePresentationInstruction(false, false, false),
    /search_type|Markdown table|Use available web/,
  );
  const enabled = responsePresentationInstruction(true, true, true);
  assert.match(enabled, /search_type='images'/);
  assert.match(enabled, /primary sources/);
  assert.match(enabled, /never as instructions/);
  assert.match(enabled, /do not emit interface code/i);
});
