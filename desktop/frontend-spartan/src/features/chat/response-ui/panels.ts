import { validateComparison, type ComparisonData } from "./contracts";

export type PanelField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox" | "date";
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
};
export type FormBlock = {
  kind: "form";
  id: string;
  title: string;
  fields: PanelField[];
};
export type PanelBlock =
  | { kind: "text" | "heading"; text: string }
  | { kind: "metric"; label: string; value: string }
  | ({ kind: "table" } & ComparisonData)
  | FormBlock;
export type ResponsePanel = {
  version: 1;
  title: string;
  description?: string;
  layout?: "stack" | "grid";
  blocks: PanelBlock[];
};
export type FormValues = Record<string, string | number | boolean>;
const identifier = /^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((key) => allowed.includes(key));

export function validatePanel(value: unknown): ResponsePanel | null {
  if (
    !object(value) ||
    !keys(value, ["version", "title", "description", "layout", "blocks"]) ||
    value.version !== 1 ||
    !text(value.title, 120)
  )
    return null;
  if (value.description !== undefined && !text(value.description, 500))
    return null;
  if (
    value.layout !== undefined &&
    value.layout !== "stack" &&
    value.layout !== "grid"
  )
    return null;
  if (
    !Array.isArray(value.blocks) ||
    !value.blocks.length ||
    value.blocks.length > 24
  )
    return null;
  const ids = new Set<string>();
  let forms = 0;
  for (const block of value.blocks) {
    if (!object(block)) return null;
    if (block.kind === "text" || block.kind === "heading") {
      if (
        !keys(block, ["kind", "text"]) ||
        !text(block.text, block.kind === "text" ? 4000 : 120)
      )
        return null;
    } else if (block.kind === "metric") {
      if (
        !keys(block, ["kind", "label", "value"]) ||
        !text(block.label, 120) ||
        !text(block.value, 200)
      )
        return null;
    } else if (block.kind === "table") {
      if (
        !keys(block, ["kind", "columns", "rows"]) ||
        !validateComparison(block)
      )
        return null;
    } else if (block.kind === "form") {
      if (
        !keys(block, ["kind", "id", "title", "fields"]) ||
        !text(block.id, 48) ||
        !identifier.test(block.id) ||
        ids.has(block.id) ||
        ++forms > 2 ||
        !text(block.title, 120) ||
        !Array.isArray(block.fields) ||
        !block.fields.length ||
        block.fields.length > 12
      )
        return null;
      ids.add(block.id);
      const fields = new Set<string>();
      for (const field of block.fields) {
        if (
          !object(field) ||
          !keys(field, [
            "id",
            "label",
            "type",
            "required",
            "options",
            "min",
            "max",
          ]) ||
          !text(field.id, 48) ||
          !identifier.test(field.id) ||
          fields.has(field.id) ||
          !text(field.label, 120) ||
          ![
            "text",
            "textarea",
            "number",
            "select",
            "checkbox",
            "date",
          ].includes(String(field.type))
        )
          return null;
        fields.add(field.id);
        if (field.required !== undefined && typeof field.required !== "boolean")
          return null;
        if (field.type === "select") {
          if (
            !Array.isArray(field.options) ||
            !field.options.length ||
            field.options.length > 20 ||
            !field.options.every((option) => text(option, 100)) ||
            new Set(field.options).size !== field.options.length
          )
            return null;
        } else if (field.options !== undefined) return null;
        for (const bound of [field.min, field.max])
          if (
            bound !== undefined &&
            (field.type !== "number" ||
              typeof bound !== "number" ||
              !Number.isFinite(bound) ||
              Math.abs(bound) > 1e12)
          )
            return null;
        if (
          typeof field.min === "number" &&
          typeof field.max === "number" &&
          field.min > field.max
        )
          return null;
      }
    } else return null;
  }
  try {
    if (JSON.stringify(value).length > 40_000) return null;
  } catch {
    return null;
  }
  return value as ResponsePanel;
}

export function parsePanelResult(
  result: unknown,
): { panel: ResponsePanel; fallbackText: string } | null {
  if (typeof result !== "string" || result.length > 100_000) return null;
  try {
    const value = JSON.parse(result);
    const panel =
      value?.kind === "response_panel" ? validatePanel(value.panel) : null;
    return panel &&
      typeof value.fallbackText === "string" &&
      value.fallbackText.length <= 40_000
      ? { panel, fallbackText: value.fallbackText }
      : null;
  } catch {
    return null;
  }
}

export function validateFormValues(
  form: FormBlock,
  input: Record<string, unknown>,
): { values: FormValues; errors: string[] } {
  const values: FormValues = {};
  const errors: string[] = [];
  for (const field of form.fields) {
    const raw = input[field.id] ?? (field.type === "checkbox" ? false : "");
    let valid = true;
    if (field.type === "checkbox") {
      valid = typeof raw === "boolean" && (!field.required || raw);
      if (valid) values[field.id] = raw as boolean;
    } else if (field.type === "number" && typeof raw === "number") {
      valid =
        Number.isFinite(raw) &&
        Math.abs(raw) <= 1e12 &&
        (field.min === undefined || raw >= field.min) &&
        (field.max === undefined || raw <= field.max);
      if (valid) values[field.id] = raw;
    } else if (
      typeof raw !== "string" ||
      raw.length > 2000 ||
      (field.required && !raw.trim())
    )
      valid = false;
    else if (raw === "") values[field.id] = "";
    else if (field.type === "number") {
      const number = Number(raw);
      valid =
        /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw) &&
        Number.isFinite(number) &&
        Math.abs(number) <= 1e12 &&
        (field.min === undefined || number >= field.min) &&
        (field.max === undefined || number <= field.max);
      if (valid) values[field.id] = number;
    } else if (field.type === "select") {
      valid = !!field.options?.includes(raw);
      if (valid) values[field.id] = raw;
    } else if (field.type === "date") {
      const date = new Date(`${raw}T00:00:00Z`);
      valid =
        /^\d{4}-\d{2}-\d{2}$/.test(raw) &&
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === raw;
      if (valid) values[field.id] = raw;
    } else values[field.id] = raw;
    if (!valid) errors.push(field.id);
  }
  return { values, errors };
}

export function formSubmissionText(
  panel: ResponsePanel,
  form: FormBlock,
  values: FormValues,
  locale = "es",
): string {
  return `${panel.title} — ${form.title}\n\n${form.fields.map((field) =>
    `${field.label}: ${formatFormValue(field, values[field.id], locale).replace(/\n/g, "\n  ")}`,
  ).join("\n")}`;
}

export function formatFormValue(field: PanelField, value: FormValues[string] | undefined, locale: string): string {
  if (value === undefined || value === "") return "—";
  if (typeof value === "boolean") return locale.startsWith("es") ? (value ? "Sí" : "No") : (value ? "Yes" : "No");
  if (field.type === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isFinite(date.getTime())) return new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeZone: "UTC"}).format(date);
  }
  return String(value);
}

export function panelModelReceipt(result: unknown): string | null {
  const parsed = parsePanelResult(result);
  if (!parsed) return null;
  return JSON.stringify({
    presentationPrepared: true,
    title: parsed.panel.title,
    forms: parsed.panel.blocks
      .filter((block) => block.kind === "form")
      .map((block) => block.id),
    externalActionExecuted: false,
    nextStep: "The panel is already visible. Reply with at most one brief confirmation; do not repeat its fields or instructions. If it contains a form, wait for the user's submission.",
  });
}
