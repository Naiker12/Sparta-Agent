/**
 * Verificación y manejo de límites de contexto para inference streaming
 */

/**
 * Detecta si un mensaje de error indica que se excedió la ventana de contexto KV.
 */
export function isContextLimitError(message: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("context size") ||
    m.includes("context shift") ||
    m.includes("exceeds the available context") ||
    m.includes("message too long") ||
    m.includes("context window") ||
    (m.includes("n_ctx") && (m.includes("exceed") || m.includes("full")))
  );
}

/**
 * Valida que una URL de fuente sea segura para navegación (http/https).
 */
export function isSafeNavigableSourceUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value || /[\r\n]/.test(value)) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return value;
    }
  } catch {
    // Fall through
  }
  return "";
}

/**
 * Convierte un diccionario de cita de documento Anthropic a una fuente utilizable en la UI.
 */
export function documentCitationToSource(
  cit: Record<string, unknown>,
  fallbackIdx: number,
): {
  type: "source";
  sourceType: "url";
  id: string;
  url: string;
  title: string;
  metadata?: { description: string };
} | null {
  const source = typeof cit.source === "string" && cit.source ? cit.source : "";
  const docTitle =
    (typeof cit.document_title === "string" && cit.document_title) ||
    (typeof cit.title === "string" && cit.title) ||
    "";
  const docIndex =
    typeof cit.document_index === "number" ? cit.document_index : undefined;
  const url =
    isSafeNavigableSourceUrl(source) ||
    `#anthropic-doc-${docIndex ?? fallbackIdx}`;
  const title = docTitle || source || `Document ${fallbackIdx + 1}`;
  const cited = typeof cit.cited_text === "string" ? cit.cited_text.trim() : "";
  const description = cited.length > 240 ? `${cited.slice(0, 240)}...` : cited;
  const citationType = typeof cit.type === "string" ? String(cit.type) : "";
  const positionParts = [
    cit.search_result_index,
    cit.start_char_index,
    cit.end_char_index,
    cit.start_page_number,
    cit.end_page_number,
    cit.start_block_index,
    cit.end_block_index,
  ]
    .filter((v) => typeof v === "number")
    .map((v) => String(v))
    .join(":");
  const idAnchor = positionParts
    ? `${citationType}:${positionParts}`
    : `${citationType}:${fallbackIdx}`;
  const id = `${url}#${idAnchor}`;
  return {
    type: "source" as const,
    sourceType: "url" as const,
    id,
    url,
    title,
    ...(description ? { metadata: { description } } : {}),
  };
}

/**
 * Parsea bloques de texto de fuentes en objetos de contenido tipados.
 */
export function parseSourcesFromResult(raw: string): {
  type: "source";
  sourceType: "url";
  id: string;
  url: string;
  title: string;
  metadata?: { description: string };
}[] {
  if (!raw) return [];
  const blocks = raw.split(/\n---\n/).filter(Boolean);
  const sources: {
    type: "source";
    sourceType: "url";
    id: string;
    url: string;
    title: string;
    metadata?: { description: string };
  }[] = [];
  for (const block of blocks) {
    const titleMatch = block.match(/Title:\s*(.+)/);
    const urlMatch = block.match(/URL:\s*(.+)/);
    const snippetMatch = block.match(/Snippet:\s*(.+)/);
    if (titleMatch && urlMatch) {
      const url = urlMatch[1].trim();
      sources.push({
        type: "source",
        sourceType: "url",
        id: url,
        url,
        title: titleMatch[1].trim(),
        ...(snippetMatch ? { metadata: { description: snippetMatch[1].trim() } } : {}),
      });
    }
  }
  return sources;
}
