import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const [tapPath, backendPath, destination = 'docs/audit'] = process.argv.slice(2);
if (!tapPath || !backendPath) throw new Error('Usage: node scripts/classify-audit-suites.mjs frontend.tap backend-collection.log [output]');
const tap = readFileSync(tapPath, 'utf8').replace(/\r\n/g, '\n');
const backend = readFileSync(backendPath, 'utf8').replace(/\r\n/g, '\n');
const labels = {
  environment: 'Entorno o fixture incompleto',
  removed_locale: 'Contrato retirado: idiomas distintos de EN/ES',
  missing_contract: 'Archivo o export ausente tras la migración',
  moved_source: 'Aserción estática sobre una ubicación antigua',
  source_review: 'Aserción estática de UI/contrato: requiere adaptación y prueba de comportamiento',
  product_review: 'Diferencia de comportamiento: validar el requisito vigente',
};
const records = [];
for (const match of tap.matchAll(/^not ok (\d+) - (.*)\n([\s\S]*?)(?=^# Subtest:|^ok |^not ok |^1\.\.|$(?![\s\S]))/gm)) {
  const block = match[3];
  const location = block.match(/location: ['"]?(.*?)['"]?\n/)?.[1] ?? '';
  const file = location.replaceAll('\\\\', '/').split('/').at(-1)?.replace(/:\d+:\d+['"]?$/, '') ?? match[2];
  let source = '';
  try { source = readFileSync(path.join('desktop/frontend-spartan/tests', file), 'utf8'); } catch {}
  let category = 'product_review';
  if (file === 'copy-to-clipboard.test.ts') category = 'environment';
  else if (file === 'lazy-locale-loading.test.ts') category = 'removed_locale';
  else if (/ENOENT|ERR_MODULE_NOT_FOUND/.test(block) || /tests\\\\.*\.test\.ts$/.test(match[2])) category = 'missing_contract';
  else if (/gone|no longer defined|needs rewriting|moved|renamed|Missing source marker|not found:/.test(block.slice(0, 700)) || /Barrel|chat-adapter\/index/.test(block.slice(0, 2500))) category = 'moved_source';
  else if (/readFileSync|readFile\(/.test(source)) category = 'source_review';
  const error = block.match(/error: ([\s\S]*?)(?=\n  (?:code|name|operator|expected|actual|stack):)/)?.[1]?.trim() ?? 'Error de carga; consultar el archivo de prueba y sus imports.';
  records.push({ test: match[2], file, location: location.replaceAll('\\\\', '/'), category, classification: labels[category], evidence: error.slice(0, 650) });
}
const summary = Object.fromEntries([...tap.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gm)].map(m => [m[1], Number(m[2])]));
if (records.length !== summary.fail) throw new Error(`Incomplete classification: ${records.length}/${summary.fail}`);
const backendErrors = [...backend.matchAll(/^_{3,} (?:ERROR collecting )?([^\n]+?) _{3,}\n([\s\S]*?)(?=^_{3,} |^=|$(?![\s\S]))/gm)].map(m => ({
  file: m[1],
  reason: [...m[2].matchAll(/^E\s+(.+)$/gm)].map(v => v[1]).slice(-2).join(' '),
}));
const counts = Object.fromEntries(Object.keys(labels).map(key => [key, records.filter(r => r.category === key).length]));
mkdirSync(destination, { recursive: true });
writeFileSync(path.join(destination, 'suite-classification.json'), JSON.stringify({ summary, counts, frontendFailures: records, backendCollection: backend.match(/\d+ tests collected, \d+ errors[^\n]*/)?.[0], backendErrors }, null, 2) + '\n');
const groups = new Map();
for (const row of records) { const key = row.file + '|' + row.category; groups.set(key, (groups.get(key) ?? 0) + 1); }
const md = `# Clasificación de suites\n\nSnapshot de la ejecución local completa del frontend: **${summary.tests} resultados, ${summary.pass} aprobados y ${summary.fail} fallidos**. Los fallos de carga de un archivo cuentan como un resultado, no como sus casos internos.\n\nCada fallo tiene clasificación y evidencia en [suite-classification.json](./suite-classification.json). Clasificar no significa corregir: las aserciones estáticas no demuestran por sí solas una regresión del producto y las diferencias de comportamiento requieren confirmar el requisito. No se desactivó ni eliminó ninguna prueba.\n\n| Categoría | Resultados |\n|---|---:|\n${Object.entries(counts).map(([k,n]) => `| ${labels[k]} | ${n} |`).join('\n')}\n\n## Archivos afectados\n\n| Archivo | Fallos | Clasificación |\n|---|---:|---|\n${[...groups].map(([key,n]) => {const [file,cat]=key.split('|');return `| ${file} | ${n} | ${labels[cat]} |`;}).join('\n')}\n\n## Backend\n\n${backend.match(/\d+ tests collected, \d+ errors[^\n]*/)?.[0] ?? 'Consultar el log de colección'}. Se intentó la colección completa con las dependencias del perfil CPU de autenticación. Los imports requieren otros perfiles; no se interpreta como ejecución ni aprobación de esas pruebas. Las causas por módulo están en el JSON.\n\n## Criterios para corregir\n\n- Fixtures: representar el entorno real; no relajar las aserciones funcionales.\n- Idiomas: reescribir los casos de carga/cancelación/fallback alrededor de los catálogos EN/ES vigentes, conservando los escenarios.\n- Archivos y exports: seguir la implementación nueva. No restaurar módulos retirados solo para satisfacer un import.\n- Aserciones estáticas: mover la comprobación al módulo propietario y reemplazarla por comportamiento observable cuando sea posible.\n- Diferencias de producto: registrar una decisión antes de cambiar una expectativa.\n- Backend: separar perfiles de autenticación/CPU, inferencia y pruebas con servidor/modelos; no instalar ni descargar modelos durante la colección.\n`;
writeFileSync(path.join(destination, 'suite-classification.md'), md);
console.log(JSON.stringify({ summary, counts, backendErrors: backendErrors.length }));
