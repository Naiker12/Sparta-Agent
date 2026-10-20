/** Presentation v1 is derived from canonical text/tool evidence, never stored
 * instead of it. Clients without OpenUI keep the exact original response. */
export type ComparisonData = { columns: string[]; rows: string[][] };
export type ReferenceImage = { title: string; url: string; imageUrl: string };
export const RESPONSE_UI_LIMITS = {
  blockChars: 40_000,
  rows: 100,
  columns: 12,
  images: 6,
} as const;

export function validateComparison(value: unknown): ComparisonData | null {
  if (!value || typeof value !== "object") return null;
  const { columns, rows } = value as ComparisonData;
  const cell = (v: unknown): v is string =>
    typeof v === "string" && v.length <= 2000;
  if (
    !Array.isArray(columns) ||
    columns.length < 2 ||
    columns.length > RESPONSE_UI_LIMITS.columns ||
    !columns.every(cell)
  )
    return null;
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    rows.length > RESPONSE_UI_LIMITS.rows ||
    !rows.every(
      (row) =>
        Array.isArray(row) && row.length === columns.length && row.every(cell),
    )
  )
    return null;
  return { columns, rows };
}

/** Reject local and active-content destinations; remote media remains opt-in. */
export function publicReferenceUrl(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    /[\s\\\u0000-\u001f]/.test(value)
  )
    return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !/^https?:$/.test(url.protocol) ||
      url.username ||
      url.password ||
      !host.includes(".") ||
      host.includes(":") ||
      /^\d+(\.\d+)*$/.test(host) ||
      /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function parseReferenceImages(result: string): ReferenceImage[] {
  if (result.length > RESPONSE_UI_LIMITS.blockChars) return [];
  const images: ReferenceImage[] = [];
  const seen = new Set<string>();
  for (const block of result.split(/\n---\n/)) {
    const url = publicReferenceUrl(block.match(/^URL:\s*(.+)$/m)?.[1]);
    const imageUrl = publicReferenceUrl(
      block.match(/^Image_URL:\s*(.+)$/m)?.[1],
    );
    const title = block.match(/^Title:\s*(.+)$/m)?.[1]?.slice(0, 200);
    if (url && imageUrl && title && !seen.has(imageUrl)) {
      seen.add(imageUrl);
      images.push({ title, url, imageUrl });
    }
    if (images.length === RESPONSE_UI_LIMITS.images) break;
  }
  return images;
}

/** Only unambiguous finite numbers. Locale decimals, currencies, percentages
 * and missing values stay in tables rather than silently changing meaning. */
export function comparisonSeries(
  data: ComparisonData,
): { label: string; value: number }[] | null {
  if (data.columns.length !== 2 || data.rows.length > 30) return null;
  if (
    !data.rows.every(
      (row) =>
        /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(row[1]) &&
        Number.isFinite(Number(row[1])) &&
        Math.abs(Number(row[1])) <= 1e12,
    )
  )
    return null;
  return data.rows.map(([label, value]) => ({ label, value: Number(value) }));
}

/** Default to a chart only for a small categorical comparison with a named quantity. */
export function preferComparisonChart(data: ComparisonData): boolean {
  return data.rows.length >= 4 && data.rows.length <= 8 &&
    /(?:cantidad|unidades|count|units|total|ventas|sales|horas|hours|kg|km)/i.test(data.columns[1] ?? "") &&
    new Set(data.rows.map(row => row[0])).size === data.rows.length &&
    comparisonSeries(data) !== null;
}

/** Payload is a quoted string, so model text cannot introduce expressions,
 * queries, actions or extra statements in the OpenUI document. */
export function presentationDocument(
  component: "Comparison" | "ReferenceGallery" | "Panel",
  data: unknown,
): string {
  return `root = ${component}(${JSON.stringify(JSON.stringify(data))})`;
}
