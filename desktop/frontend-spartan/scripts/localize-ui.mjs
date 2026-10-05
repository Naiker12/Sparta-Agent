import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { en } from "../src/i18n/locales/en/index.ts";
import { es } from "../src/i18n/locales/es/index.ts";

function flatten(tree, prefix = "", result = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[name] = value;
    else flatten(value, name, result);
  }
  return result;
}
const english = flatten(en);
const spanish = flatten(es);
const keys = new Map();
const templateKeys = new Map();
for (const [key, value] of Object.entries(english)) {
  if (!value.includes("{")) keys.set(value, key);
  if (spanish[key] && !spanish[key].includes("{")) keys.set(spanish[key], key);
  templateKeys.set(value, key);
  if (spanish[key]) templateKeys.set(spanish[key], key);
}
const apply = process.argv.includes("--apply");
let count = 0;
const missing = [];
const metadataMissing = [];
const includeMetadata = process.argv.includes("--metadata");

function isMessageLiteral(node) {
  let value = node;
  while (ts.isConditionalExpression(value.parent) && (value.parent.whenTrue === value || value.parent.whenFalse === value) || ts.isParenthesizedExpression(value.parent)) value = value.parent;
  const owner = value.parent;
  return (ts.isNewExpression(owner) && owner.expression.getText() === "Error" && owner.arguments?.[0] === value) ||
    (ts.isCallExpression(owner) && /^(toast(?:\.(?:error|success|warning|info))?|toastError|toastSuccess|setError|setImageError)$/.test(owner.expression.getText()) && owner.arguments[0] === value);
}
function componentScope(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!ts.isFunctionDeclaration(parent) && !ts.isArrowFunction(parent) && !ts.isFunctionExpression(parent)) continue;
    if (node.getStart() < parent.body?.getStart()) continue;
    let name = parent.name?.getText();
    let owner = parent.parent;
    while (owner && (ts.isCallExpression(owner) || ts.isParenthesizedExpression(owner))) owner = owner.parent;
    if (ts.isVariableDeclaration(owner)) name = owner.name.getText();
    if (name && /^[A-Z]/.test(name) && parent.body) return parent;
  }
  return null;
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name === "memory" && process.argv.includes("--exclude-memory")) continue; walk(file); continue; }
    if (!file.endsWith(".tsx") && !(includeMetadata && file.endsWith(".ts"))) continue;
    if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
    const source = fs.readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edits = [];
    const scopes = new Set();
    let needsUiText = false;
    let needsTranslate = false;
    function visit(node) {
      if (includeMetadata && ts.isStringLiteralLike(node) && isMessageLiteral(node)) {
        const key = templateKeys.get(node.text);
        if (key) {
          edits.push({ start: node.getStart(ast), end: node.end, replacement: `uiTranslate(${JSON.stringify(key)})` });
          needsTranslate = true; count++;
        } else metadataMissing.push({ file, text: node.text, kind: "message" });
      }
      if (includeMetadata && ts.isPropertyAssignment(node) && ["label", "title", "description", "hint", "placeholder", "emptyMessage"].includes(node.name.getText(ast)) && ts.isStringLiteralLike(node.initializer)) {
        const value = node.initializer.text, key = templateKeys.get(value);
        if (key && value.trim()) {
          edits.push({ start: node.getStart(ast), end: node.end, replacement: `get ${node.name.getText(ast)}() { return uiTranslate(${JSON.stringify(key)}); }` });
          needsTranslate = true; count++;
        } else if (value.trim()) metadataMissing.push({ file, text: value });
      }
      let value, replacement;
      if (ts.isJsxText(node)) value = node.text.replace(/\s+/g, " ").trim();
      else if (ts.isJsxAttribute(node) && ["title", "aria-label", "placeholder", "alt", "description", "label", "info", "tooltip", "subtitle", "emptyTitle", "emptyDescription", "helpText", "caption"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) value = node.initializer.text;
      else if (ts.isStringLiteral(node) && ts.isJsxExpression(node.parent) && (!ts.isJsxAttribute(node.parent.parent) || ["title", "aria-label", "placeholder", "alt", "description", "label", "info", "tooltip", "subtitle", "emptyTitle", "emptyDescription", "helpText", "caption"].includes(node.parent.parent.name.getText(ast)))) value = node.text;
      else if (ts.isStringLiteral(node)) {
        let parent = node.parent;
        let child = node;
        while (parent && (
          (ts.isConditionalExpression(parent) && parent.condition !== child) ||
          (ts.isBinaryExpression(parent) && parent.right === child && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind)) ||
          ts.isParenthesizedExpression(parent)
        )) { child = parent; parent = parent.parent; }
        if (parent && ts.isJsxExpression(parent) && (!ts.isJsxAttribute(parent.parent) || ["title", "aria-label", "placeholder", "alt", "description", "label", "info", "tooltip", "subtitle", "emptyTitle", "emptyDescription", "helpText", "caption"].includes(parent.parent.name.getText(ast)))) value = node.text;
      }
      if (ts.isTemplateExpression(node) && ts.isJsxExpression(node.parent) && (!ts.isJsxAttribute(node.parent.parent) || ["title", "aria-label", "placeholder", "alt", "description", "label", "info", "tooltip", "subtitle", "emptyTitle", "emptyDescription", "helpText", "caption"].includes(node.parent.parent.name.getText(ast)))) {
        let text = node.head.text;
        node.templateSpans.forEach((span, index) => { text += `{value${index}}` + span.literal.text; });
        const key = templateKeys.get(text), scope = componentScope(node);
        if (key && scope) {
          const values = node.templateSpans.map((span, index) => `value${index}: String(${span.expression.getText(ast)})`).join(", ");
          edits.push({ start: node.getStart(ast), end: node.end, replacement: `uiT(${JSON.stringify(key)}, { ${values} })` });
          scopes.add(scope); count++;
        }
      }
      if (value && /[A-Za-zÁÉÍÓÚáéíóúñ]/.test(value)) {
        const key = keys.get(value);
        const scope = componentScope(node);
        if (key && scope) {
          const call = `uiT(${JSON.stringify(key)})`;
          if (ts.isJsxText(node)) {
            const leading = /^\s/.test(node.text) && !/^\s*\n/.test(node.text) ? '{" "}' : "";
            const trailing = /\s$/.test(node.text) && !/\n\s*$/.test(node.text) ? '{" "}' : "";
            replacement = leading + `{${call}}` + trailing;
            edits.push({ start: node.getStart(ast), end: node.end, replacement });
          } else if (ts.isJsxAttribute(node)) {
            edits.push({ start: node.initializer.getStart(ast), end: node.initializer.end, replacement: `{${call}}` });
          } else edits.push({ start: node.getStart(ast), end: node.end, replacement: call });
          scopes.add(scope); count++;
        } else if (key && ts.isJsxText(node)) {
          edits.push({ start: node.getStart(ast), end: node.end, replacement: `<UiText messageKey=${JSON.stringify(key)} />` });
          needsUiText = true; count++;
        } else missing.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, text: value, reason: key ? "scope" : "catalog" });
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    if (!edits.length || !apply) continue;
    for (const scope of scopes) {
      const body = scope.body;
      if (/\bconst uiT\s*=\s*useUiT\(/.test(body.getText(ast))) continue;
      if (ts.isBlock(body)) edits.push({ start: body.getStart(ast) + 1, end: body.getStart(ast) + 1, replacement: "\n  const uiT = useUiT();\n" });
      else {
        edits.push({ start: body.getStart(ast), end: body.getStart(ast), replacement: "{ const uiT = useUiT(); return (" });
        edits.push({ start: body.end, end: body.end, replacement: "); }" });
      }
    }
    if (scopes.size && !source.includes("useT as useUiT")) edits.push({ start: 0, end: 0, replacement: 'import { useT as useUiT } from "@/i18n";\n' });
    if (needsUiText && !source.includes('import { UiText }')) edits.push({ start: 0, end: 0, replacement: 'import { UiText } from "@/i18n/ui-text";\n' });
    if (needsTranslate && !source.includes("translate as uiTranslate")) edits.push({ start: 0, end: 0, replacement: 'import { translate as uiTranslate } from "@/i18n";\n' });
    let updated = source;
    for (const edit of edits.sort((a, b) => b.start - a.start)) updated = updated.slice(0, edit.start) + edit.replacement + updated.slice(edit.end);
    fs.writeFileSync(file, updated);
  }
}
walk("src");
fs.mkdirSync("../../output/i18n-review", { recursive: true });
fs.writeFileSync("../../output/i18n-review/remaining.json", JSON.stringify(missing, null, 2));
if (includeMetadata) fs.writeFileSync("../../output/i18n-review/metadata-remaining.json", JSON.stringify(metadataMissing, null, 2));
console.log(`${apply ? "Localized" : "Ready to localize"}: ${count}; remaining literal entries: ${missing.length}`);
