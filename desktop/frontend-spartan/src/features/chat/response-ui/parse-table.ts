import { fromMarkdown } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown } from "mdast-util-gfm";
import {
  RESPONSE_UI_LIMITS,
  validateComparison,
  type ComparisonData,
} from "./contracts";

type Inline = { type: string; value?: string; children?: Inline[] };
function plainCell(node: Inline): string | null {
  if (node.type === "text" || node.type === "inlineCode")
    return node.value ?? "";
  if (!["tableCell", "emphasis", "strong"].includes(node.type)) return null;
  const children = (node.children ?? []).map(plainCell);
  return children.some((value) => value === null) ? null : children.join("");
}

export function parseComparisonMarkdown(
  markdown: string,
): ComparisonData | null {
  if (
    markdown.length > RESPONSE_UI_LIMITS.blockChars ||
    !markdown.includes("|")
  )
    return null;
  try {
    const root = fromMarkdown(markdown, {
      extensions: [gfm()],
      mdastExtensions: [gfmFromMarkdown()],
    });
    if (root.children.length !== 1 || root.children[0].type !== "table")
      return null;
    const table = root.children[0];
    const rows = table.children.map((row) =>
      row.children.map((cell) => plainCell(cell)),
    );
    // Preserve Markdown's link, image, HTML and other semantics by falling back
    // whenever a cell cannot be represented faithfully as plain text.
    if (rows.flat().some((cell) => cell === null)) return null;
    return validateComparison({ columns: rows[0], rows: rows.slice(1) });
  } catch {
    return null;
  }
}
