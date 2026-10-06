import { translate as uiTranslate } from "@/i18n";
import type { RecipePayload } from "@/features/recipe-studio";

const structuredOutputsJinjaUrl = new URL(
  "./structured-outputs-jinja.json",
  import.meta.url,
).href;
const pdfGroundedQaUrl = new URL("./pdf-grounded-qa.json", import.meta.url)
  .href;
const instructionFromAnswerUrl = new URL(
  "./instruction-from-answer.json",
  import.meta.url,
).href;
const textToPythonUrl = new URL("./text-to-python.json", import.meta.url).href;
const textToSqlUrl = new URL("./text-to-sql.json", import.meta.url).href;
const ocrDocumentExtractionUrl = new URL(
  "./ocr-document-extraction.json",
  import.meta.url,
).href;
const githubSupportBotUrl = new URL(
  "./github-support-bot.json",
  import.meta.url,
).href;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Record<string, unknown> =>
    isRecord(item),
  );
}

function coerceRecipePayload(value: unknown): RecipePayload {
  if (!isRecord(value)) {
    throw new Error("Template payload is invalid JSON object.");
  }

  const recipeSource = isRecord(value.recipe) ? value.recipe : value;
  if (!Array.isArray(recipeSource.columns)) {
    throw new Error("Template payload must include recipe.columns.");
  }

  if (isRecord(value.recipe) && isRecord(value.run) && isRecord(value.ui)) {
    return value as unknown as RecipePayload;
  }

  const recipe: RecipePayload["recipe"] = {
    // biome-ignore lint/style/useNamingConvention: api schema
    model_providers: toRecordArray(recipeSource.model_providers),
    // biome-ignore lint/style/useNamingConvention: api schema
    mcp_providers: toRecordArray(recipeSource.mcp_providers),
    // biome-ignore lint/style/useNamingConvention: api schema
    model_configs: toRecordArray(recipeSource.model_configs),
    // biome-ignore lint/style/useNamingConvention: api schema
    seed_config: isRecord(recipeSource.seed_config)
      ? recipeSource.seed_config
      : undefined,
    // biome-ignore lint/style/useNamingConvention: api schema
    tool_configs: toRecordArray(recipeSource.tool_configs),
    columns: toRecordArray(recipeSource.columns),
    processors: toRecordArray(recipeSource.processors),
  };

  return {
    recipe,
    run: {
      rows: 5,
      preview: true,
      // biome-ignore lint/style/useNamingConvention: api schema
      output_formats: ["jsonl"],
    },
    ui: {
      nodes: [],
      edges: [],
    },
  };
}

async function loadPayloadFromUrl(url: string): Promise<RecipePayload> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch template payload (${response.status})`);
  }
  const json = (await response.json()) as unknown;
  return coerceRecipePayload(json);
}

export type LearningRecipeDef = {
  id: string;
  title: string;
  description: string;
  loadPayload: () => Promise<RecipePayload>;
};

export const LEARNING_RECIPES: LearningRecipeDef[] = [
  {
    id: "structured-outputs-jinja",
    get title() { return uiTranslate("ui.structured_outputs_jinja_expressions"); },
    get description() { return uiTranslate("ui.support_ticket_triage_with_structured_json_outputs_and_jinja_cond"); },
    loadPayload: () => loadPayloadFromUrl(structuredOutputsJinjaUrl),
  },
  {
    id: "pdf-grounded-qa",
    get title() { return uiTranslate("ui.pdf_document_qa"); },
    get description() { return uiTranslate("ui.build_grounded_question_answer_examples_from_pdf_chunks"); },
    loadPayload: () => loadPayloadFromUrl(pdfGroundedQaUrl),
  },
  {
    id: "instruction-from-answer",
    get title() { return uiTranslate("ui.instruction_from_answer"); },
    get description() { return uiTranslate("ui.use_seed_answer_columns_to_generate_high_quality_instruction_targ"); },
    loadPayload: () => loadPayloadFromUrl(instructionFromAnswerUrl),
  },
  {
    id: "text-to-python",
    get title() { return uiTranslate("ui.text_to_python"); },
    get description() { return uiTranslate("ui.generate_instruction_to_code_data_with_category_sampling_and_llm_"); },
    loadPayload: () => loadPayloadFromUrl(textToPythonUrl),
  },
  {
    id: "text-to-sql",
    get title() { return uiTranslate("ui.text_to_sql"); },
    get description() { return uiTranslate("ui.generate_sql_tasks_and_runnable_sql_outputs_with_prompt_driven_ge"); },
    loadPayload: () => loadPayloadFromUrl(textToSqlUrl),
  },
  {
    id: "ocr-document-extraction",
    get title() { return uiTranslate("ui.ocr_document_extraction"); },
    get description() { return uiTranslate("ui.use_image_context_to_generate_ocr_style_document_extraction_outpu"); },
    loadPayload: () => loadPayloadFromUrl(ocrDocumentExtractionUrl),
  },
  {
    id: "github-support-bot",
    get title() { return uiTranslate("ui.github_crawler"); },
    get description() { return uiTranslate("ui.crawl_real_github_issues_and_prs_and_turn_each_thread_into_a_user"); },
    loadPayload: () => loadPayloadFromUrl(githubSupportBotUrl),
  },
];
