import { parsePartialJsonObject } from "assistant-stream/utils";

/**
 * Parsea de forma incremental los argumentos JSON de herramientas en streaming,
 * permitiendo renderizar las tarjetas visuales mientras el modelo aún los escribe.
 */
export function parseLiveToolArgs(
  raw: string,
): { args: Record<string, unknown>; argsText: string } | null {
  let candidate = raw.trimStart();
  if (!candidate.startsWith("{")) {
    const brace = candidate.indexOf("{");
    if (brace < 0) return null;
    candidate = candidate.slice(brace);
  }
  const parsed = parsePartialJsonObject(candidate) as
    | Record<string, unknown>
    | undefined;
  if (!parsed || typeof parsed !== "object") return null;

  const inner = parsed.arguments ?? parsed.parameters;
  if (typeof parsed.name === "string" && inner !== undefined) {
    if (typeof inner === "string") {
      const innerParsed = parsePartialJsonObject(inner) as
        | Record<string, unknown>
        | undefined;
      if (innerParsed && typeof innerParsed === "object") {
        return { args: innerParsed, argsText: inner };
      }
      return null;
    }
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return {
        args: inner as Record<string, unknown>,
        argsText: JSON.stringify(inner),
      };
    }
    return null;
  }
  return { args: parsed, argsText: candidate };
}
