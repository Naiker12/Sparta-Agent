function parseSystemVariablesMap(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Invalid JSON: keep unresolved placeholders in output prompt.
  }
  return {};
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function getNestedValue(values: Record<string, unknown>, path: string): unknown | undefined {
  const parts = path.split(".").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  let current: unknown = values;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    if (!hasOwn(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function formatLocalDate(now: Date): string {
  return [now.getFullYear(), padDatePart(now.getMonth() + 1), padDatePart(now.getDate())].join("-");
}

function formatLocalTime(now: Date): string {
  return [padDatePart(now.getHours()), padDatePart(now.getMinutes()), padDatePart(now.getSeconds())].join(":");
}

function formatTimezoneOffset(now: Date): string {
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${sign}${padDatePart(Math.floor(absoluteOffset / 60))}:${padDatePart(absoluteOffset % 60)}`;
}

function stringifyTemplateValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Context sent on every request so relative dates such as "tomorrow" are
 * interpreted from the user's computer clock instead of model training data. */
export function buildCurrentTemporalContext(
  locale: string,
  now = new Date(),
): string {
  const localDate = formatLocalDate(now);
  const localTime = formatLocalTime(now);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  const dayOfWeek = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(now);
  return [
    "<current_datetime>",
    `Local date: ${localDate}`,
    `Local time: ${localTime}${formatTimezoneOffset(now)}`,
    `Day of week: ${dayOfWeek}`,
    `Time zone: ${timeZone}`,
    "Use this as the current local date and time for relative expressions such as today, tomorrow, yesterday, and next week.",
    "</current_datetime>",
  ].join("\n");
}

export function resolveSystemPromptVariables(prompt: string, customVariablesRaw: string): string {
  if (!prompt) return prompt;
  const now = new Date();
  const localDate = formatLocalDate(now);
  const localTime = formatLocalTime(now);
  const systemVariables: Record<string, string> = {
    $date: localDate,
    $time: localTime,
    $now: `${localDate}T${localTime}${formatTimezoneOffset(now)}`,
  };
  const customVariables = parseSystemVariablesMap(customVariablesRaw);
  return prompt.replaceAll(/{{\s*([a-zA-Z_$][a-zA-Z0-9_$.-]*)\s*}}/g, (full, keyRaw) => {
    const key = String(keyRaw).trim();
    if (hasOwn(systemVariables, key)) return systemVariables[key] ?? full;
    const resolved = getNestedValue(customVariables, key);
    return resolved === undefined ? full : stringifyTemplateValue(resolved);
  });
}
