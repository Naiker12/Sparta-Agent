import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const sourceRoot = path.join(root, 'desktop/frontend-spartan/src');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(tsx?|css)$/.test(file)) files.push(file);
  }
}
walk(sourceRoot);
const referenced = new Set();
for (const file of files) {
  if (!/\.tsx?$/.test(file)) continue;
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isStringLiteral(node)) {
      const value = node.text;
      if (value.startsWith('.') || value.startsWith('@/')) {
        const base = value.startsWith('@/') ? path.join(sourceRoot, value.slice(2)) : path.resolve(path.dirname(file), value);
        for (const candidate of [base, ...['.ts', '.tsx', '.css', '/index.ts', '/index.tsx'].map(suffix => base + suffix)]) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) referenced.add(path.normalize(candidate));
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const candidates = files.filter(file => !referenced.has(file) && !/main\.tsx$|vite-env\.d\.ts$/.test(file));
const ui = fs.readFileSync(path.join(sourceRoot, 'i18n/locales/es/ui.ts'), 'utf8');
const otherSources = files.filter(file => !file.includes(`${path.sep}locales${path.sep}`)).map(file => fs.readFileSync(file, 'utf8')).join('\n');
const unusedLegacyKeys = [...ui.matchAll(/^\s*"(legacy_[^"]+)":/gm)].map(match => match[1]).filter(key => !otherSources.includes(key));
const report = { note: 'Candidates require review: entry points, generated files and dynamic loaders may have no static import.', unreferencedSourceCandidates: candidates.map(file => path.relative(root, file)), unusedLegacyTranslationKeys: unusedLegacyKeys };
fs.mkdirSync(path.join(root, 'output/cleanup'), { recursive: true });
fs.writeFileSync(path.join(root, 'output/cleanup/audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
