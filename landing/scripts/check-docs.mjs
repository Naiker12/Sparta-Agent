import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateDocsCatalog } from './docs-catalog.mjs';

const pages = generateDocsCatalog();
const slugs = new Set(pages.map(page => page.slug));
const errors = [];
let links = 0;
for (const page of pages) {
  if (!page.description) errors.push(`${page.slug}: missing description`);
  const source = readFileSync(fileURLToPath(new URL(`../src/components/docs/content/pages/${page.slug}.mdx`, import.meta.url)), 'utf8');
  if (/^# /m.test(source)) errors.push(`${page.slug}: duplicate level-one heading`);
  for (const match of source.matchAll(/(?:href=["']|\]\()(\/docs\/[^\s"')#]+)(?:#[^\s"')]+)?/g)) {
    links++;
    if (!slugs.has(match[1].slice(6))) errors.push(`${page.slug}: broken link ${match[1]}`);
  }
}
const navigation = readFileSync(new URL('../src/components/docs/lib/navigation.ts', import.meta.url), 'utf8');
const listed = [...navigation.matchAll(/pages: \[([^\]]+)\]/g)].flatMap(match => [...match[1].matchAll(/'([^']+)'/g)].map(value => value[1]));
for (const slug of slugs) if (!listed.includes(slug)) errors.push(`${slug}: missing navigation entry`);
for (const slug of listed) if (!slugs.has(slug)) errors.push(`${slug}: missing page`);
if (new Set(listed).size !== listed.length) errors.push('Duplicate navigation entries');
if (errors.length) throw new Error(errors.join('\n'));
console.log(`Documentation checked: ${pages.length} pages, ${links} internal links, complete navigation.`);
