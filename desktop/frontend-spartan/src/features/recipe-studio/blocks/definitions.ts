import { translate as uiTranslate } from "@/i18n";
import {
  BalanceScaleIcon,
  Clock01Icon,
  CodeIcon,
  CodeSimpleIcon,
  DiceFaces03Icon,
  DocumentAttachmentIcon,
  DocumentCodeIcon,
  EqualSignIcon,
  FingerPrintIcon,
  FunctionIcon,
  GithubIcon,
  Parabola02Icon,
  PencilEdit02Icon,
  Plant01Icon,
  Plug01Icon,
  Shield02Icon,
  Tag01Icon,
  TagsIcon,
  UserAccountIcon,
} from "@hugeicons/core-free-icons";
import type {
  LlmType,
  NodeConfig,
  SamplerType,
  SeedSourceType,
} from "../types";
import {
  makeExpressionConfig,
  makeLlmConfig,
  makeMarkdownNoteConfig,
  makeModelConfig,
  makeModelProviderConfig,
  makeSamplerConfig,
  makeSeedConfig,
  makeToolProfileConfig,
  makeValidatorConfig,
} from "../utils";

export type BlockKind =
  | "sampler"
  | "llm"
  | "validator"
  | "expression"
  | "seed"
  | "note";
export type BlockType =
  | SamplerType
  | LlmType
  | "validator_python"
  | "validator_sql"
  | "validator_oxc"
  | "expression"
  | "markdown_note"
  | "seed"
  | "seed_hf"
  | "seed_local"
  | "seed_unstructured"
  | "seed_github"
  | "model_provider"
  | "model_config"
  | "tool_config";

export type SeedBlockType =
  | "seed_hf"
  | "seed_local"
  | "seed_unstructured"
  | "seed_github";

type IconType = typeof CodeIcon;

export type BlockGroup = {
  kind: BlockKind;
  title: string;
  description: string;
  icon: IconType;
};

export type BlockDialogKey =
  | "seed"
  | "markdown_note"
  | "category"
  | "subcategory"
  | "uniform"
  | "gaussian"
  | "bernoulli"
  | "datetime"
  | "timedelta"
  | "uuid"
  | "person"
  | "llm"
  | "validator"
  | "model_provider"
  | "model_config"
  | "tool_config"
  | "expression";

export type BlockDefinition = {
  kind: BlockKind;
  type: BlockType;
  title: string;
  description: string;
  icon: IconType;
  dialogKey: BlockDialogKey;
  createConfig: (id: string, existing: NodeConfig[]) => NodeConfig;
};

export const BLOCK_GROUPS: BlockGroup[] = [
  {
    kind: "sampler",
    get title() { return uiTranslate("ui.generated_fields"); },
    get description() { return uiTranslate("ui.create_fields_from_lists_ranges_and_reusable_patterns"); },
    icon: DiceFaces03Icon,
  },
  {
    kind: "seed",
    get title() { return uiTranslate("ui.source_data"); },
    get description() { return uiTranslate("ui.start_from_an_existing_dataset_or_file"); },
    icon: Plant01Icon,
  },
  {
    kind: "llm",
    get title() { return uiTranslate("ui.ai_generation"); },
    get description() { return uiTranslate("ui.generate_content_connect_models_and_manage_tools"); },
    icon: PencilEdit02Icon,
  },
  {
    kind: "validator",
    get title() { return uiTranslate("ui.checks"); },
    get description() { return uiTranslate("ui.lint_or_filter_generated_code_as_it_moves_through_the_recipe"); },
    icon: Shield02Icon,
  },
  {
    kind: "expression",
    get title() { return uiTranslate("ui.formulas"); },
    get description() { return uiTranslate("ui.build_a_field_from_other_fields"); },
    icon: FunctionIcon,
  },
  {
    kind: "note",
    get title() { return uiTranslate("ui.notes"); },
    get description() { return uiTranslate("ui.add_markdown_notes_to_document_your_flow"); },
    icon: PencilEdit02Icon,
  },
];

const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    kind: "seed",
    type: "seed_hf",
    get title() { return uiTranslate("ui.hugging_face_dataset"); },
    get description() { return uiTranslate("ui.use_rows_from_a_hugging_face_dataset_as_source_data"); },
    icon: Plant01Icon,
    dialogKey: "seed",
    createConfig: (id, existing) => makeSeedConfig(id, existing, "hf"),
  },
  {
    kind: "seed",
    type: "seed_local",
    get title() { return uiTranslate("ui.csv_or_json_file"); },
    get description() { return uiTranslate("ui.upload_csv_json_or_jsonl_and_use_its_rows_as_source_data"); },
    icon: DocumentCodeIcon,
    dialogKey: "seed",
    createConfig: (id, existing) => makeSeedConfig(id, existing, "local"),
  },
  {
    kind: "seed",
    type: "seed_unstructured",
    get title() { return uiTranslate("ui.document_file"); },
    get description() { return uiTranslate("ui.upload_pdf_docx_or_txt_and_turn_it_into_source_rows"); },
    icon: DocumentAttachmentIcon,
    dialogKey: "seed",
    createConfig: (id, existing) =>
      makeSeedConfig(id, existing, "unstructured"),
  },
  {
    kind: "seed",
    type: "seed_github",
    get title() { return uiTranslate("ui.github_repositories"); },
    get description() { return uiTranslate("ui.crawl_issues_pull_requests_and_commits_from_one_or_more_github_re"); },
    icon: GithubIcon,
    dialogKey: "seed",
    createConfig: (id, existing) => makeSeedConfig(id, existing, "github_repo"),
  },
  {
    kind: "sampler",
    type: "category",
    get title() { return uiTranslate("ui.category"); },
    get description() { return uiTranslate("ui.generate_values_from_a_list_you_define_with_optional_weights_or_r"); },
    icon: Tag01Icon,
    dialogKey: "category",
    createConfig: (id, existing) => makeSamplerConfig(id, "category", existing),
  },
  {
    kind: "sampler",
    type: "subcategory",
    get title() { return uiTranslate("ui.subcategory"); },
    get description() { return uiTranslate("ui.generate_values_from_groups_you_define_for_each_category"); },
    icon: TagsIcon,
    dialogKey: "subcategory",
    createConfig: (id, existing) =>
      makeSamplerConfig(id, "subcategory", existing),
  },
  {
    kind: "sampler",
    type: "uniform",
    get title() { return uiTranslate("ui.random_number"); },
    get description() { return uiTranslate("ui.generate_a_number_anywhere_between_a_minimum_and_maximum"); },
    icon: EqualSignIcon,
    dialogKey: "uniform",
    createConfig: (id, existing) => makeSamplerConfig(id, "uniform", existing),
  },
  {
    kind: "sampler",
    type: "gaussian",
    get title() { return uiTranslate("ui.bell_curve_number"); },
    get description() { return uiTranslate("ui.generate_numbers_around_an_average_value"); },
    icon: Parabola02Icon,
    dialogKey: "gaussian",
    createConfig: (id, existing) => makeSamplerConfig(id, "gaussian", existing),
  },
  {
    kind: "sampler",
    type: "bernoulli",
    get title() { return uiTranslate("ui.yes_no_value"); },
    get description() { return uiTranslate("ui.generate_a_binary_result_from_a_probability"); },
    icon: EqualSignIcon,
    dialogKey: "bernoulli",
    createConfig: (id, existing) =>
      makeSamplerConfig(id, "bernoulli", existing),
  },
  {
    kind: "sampler",
    type: "datetime",
    get title() { return uiTranslate("ui.date_and_time"); },
    get description() { return uiTranslate("ui.generate_timestamps_inside_a_date_range"); },
    icon: Clock01Icon,
    dialogKey: "datetime",
    createConfig: (id, existing) => makeSamplerConfig(id, "datetime", existing),
  },
  {
    kind: "sampler",
    type: "timedelta",
    get title() { return uiTranslate("ui.time_offset"); },
    get description() { return uiTranslate("ui.generate_a_time_difference_from_another_date_field"); },
    icon: Clock01Icon,
    dialogKey: "timedelta",
    createConfig: (id, existing) =>
      makeSamplerConfig(id, "timedelta", existing),
  },
  {
    kind: "sampler",
    type: "uuid",
    get title() { return uiTranslate("ui.unique_id"); },
    get description() { return uiTranslate("ui.generate_unique_identifiers"); },
    icon: FingerPrintIcon,
    dialogKey: "uuid",
    createConfig: (id, existing) => makeSamplerConfig(id, "uuid", existing),
  },
  {
    kind: "sampler",
    type: "person",
    get title() { return uiTranslate("ui.synthetic_person"); },
    get description() { return uiTranslate("ui.generate_realistic_person_details"); },
    icon: UserAccountIcon,
    dialogKey: "person",
    createConfig: (id, existing) => makeSamplerConfig(id, "person", existing),
  },
  {
    kind: "llm",
    type: "text",
    get title() { return uiTranslate("ui.ai_text"); },
    get description() { return uiTranslate("ui.generate_text_from_your_prompt"); },
    icon: PencilEdit02Icon,
    dialogKey: "llm",
    createConfig: (id, existing) => makeLlmConfig(id, "text", existing),
  },
  {
    kind: "llm",
    type: "structured",
    get title() { return uiTranslate("ui.ai_structured_data"); },
    get description() { return uiTranslate("ui.generate_json_that_follows_a_response_format"); },
    icon: CodeIcon,
    dialogKey: "llm",
    createConfig: (id, existing) => makeLlmConfig(id, "structured", existing),
  },
  {
    kind: "llm",
    type: "code",
    get title() { return uiTranslate("ui.ai_code"); },
    get description() { return uiTranslate("ui.generate_code_in_the_language_you_choose"); },
    icon: CodeSimpleIcon,
    dialogKey: "llm",
    createConfig: (id, existing) => makeLlmConfig(id, "code", existing),
  },
  {
    kind: "llm",
    type: "judge",
    get title() { return uiTranslate("ui.ai_scorer"); },
    get description() { return uiTranslate("ui.score_outputs_against_your_criteria"); },
    icon: BalanceScaleIcon,
    dialogKey: "llm",
    createConfig: (id, existing) => makeLlmConfig(id, "judge", existing),
  },
  {
    kind: "llm",
    type: "model_provider",
    get title() { return uiTranslate("ui.provider_connection"); },
    get description() { return uiTranslate("ui.choose_where_model_requests_go_and_how_to_sign_in"); },
    icon: Shield02Icon,
    dialogKey: "model_provider",
    createConfig: (id, existing) => makeModelProviderConfig(id, existing),
  },
  {
    kind: "llm",
    type: "model_config",
    get title() { return uiTranslate("ui.model_preset"); },
    get description() { return uiTranslate("ui.pick_a_model_and_save_reusable_generation_settings"); },
    icon: Plant01Icon,
    dialogKey: "model_config",
    createConfig: (id, existing) => makeModelConfig(id, existing),
  },
  {
    kind: "llm",
    type: "tool_config",
    get title() { return uiTranslate("ui.tool_access"); },
    get description() { return uiTranslate("ui.choose_which_tools_an_ai_step_can_use"); },
    icon: Plug01Icon,
    dialogKey: "tool_config",
    createConfig: (id, existing) => makeToolProfileConfig(id, existing),
  },
  {
    kind: "validator",
    type: "validator_python",
    get title() { return uiTranslate("ui.python_check"); },
    get description() { return uiTranslate("ui.lint_generated_python_and_filter_out_rows_that_fail"); },
    icon: Shield02Icon,
    dialogKey: "validator",
    createConfig: (id, existing) =>
      makeValidatorConfig(id, "code", "python", existing),
  },
  {
    kind: "validator",
    type: "validator_sql",
    get title() { return uiTranslate("ui.sql_check"); },
    get description() { return uiTranslate("ui.lint_generated_sql_and_filter_out_rows_that_fail"); },
    icon: Shield02Icon,
    dialogKey: "validator",
    createConfig: (id, existing) =>
      makeValidatorConfig(id, "code", "sql:sqlite", existing),
  },
  {
    kind: "validator",
    type: "validator_oxc",
    get title() { return uiTranslate("ui.js_ts_check"); },
    get description() { return uiTranslate("ui.lint_generated_javascript_or_typescript_and_filter_out_rows_that_"); },
    icon: Shield02Icon,
    dialogKey: "validator",
    createConfig: (id, existing) =>
      makeValidatorConfig(id, "oxc", "javascript", existing),
  },
  {
    kind: "expression",
    type: "expression",
    get title() { return uiTranslate("ui.formula"); },
    get description() { return uiTranslate("ui.build_or_transform_a_field_using_other_fields"); },
    icon: FunctionIcon,
    dialogKey: "expression",
    createConfig: (id, existing) => makeExpressionConfig(id, existing),
  },
  {
    kind: "note",
    type: "markdown_note",
    get title() { return uiTranslate("ui.note"); },
    get description() { return uiTranslate("ui.add_a_note_to_the_canvas_notes_do_not_affect_the_run"); },
    icon: PencilEdit02Icon,
    dialogKey: "markdown_note",
    createConfig: (id, existing) => makeMarkdownNoteConfig(id, existing),
  },
];

export function getBlocksForKind(kind: BlockKind): BlockDefinition[] {
  return BLOCK_DEFINITIONS.filter((block) => block.kind === kind);
}

export function getBlockDefinition(
  kind: BlockKind,
  type: BlockType,
): BlockDefinition | null {
  return (
    BLOCK_DEFINITIONS.find(
      (block) => block.kind === kind && block.type === type,
    ) ?? null
  );
}

export function getBlockDefinitionForConfig(
  config: NodeConfig | null,
): BlockDefinition | null {
  if (!config) {
    return null;
  }
  if (config.kind === "seed") {
    const seedType: Record<SeedSourceType, SeedBlockType> = {
      hf: "seed_hf",
      local: "seed_local",
      unstructured: "seed_unstructured",
      github_repo: "seed_github",
    };
    return getBlockDefinition(
      "seed",
      seedType[config.seed_source_type ?? "hf"],
    );
  }
  if (config.kind === "sampler") {
    const samplerType =
      config.sampler_type === "person_from_faker"
        ? "person"
        : config.sampler_type;
    return getBlockDefinition("sampler", samplerType);
  }
  if (config.kind === "llm") {
    return getBlockDefinition("llm", config.llm_type);
  }
  if (config.kind === "validator") {
    if (config.validator_type === "oxc") {
      return getBlockDefinition("validator", "validator_oxc");
    }
    const isSql = config.code_lang.startsWith("sql:");
    return getBlockDefinition(
      "validator",
      isSql ? "validator_sql" : "validator_python",
    );
  }
  if (config.kind === "model_provider") {
    return getBlockDefinition("llm", "model_provider");
  }
  if (config.kind === "model_config") {
    return getBlockDefinition("llm", "model_config");
  }
  if (config.kind === "tool_config") {
    return getBlockDefinition("llm", "tool_config");
  }
  if (config.kind === "markdown_note") {
    return getBlockDefinition("note", "markdown_note");
  }
  return getBlockDefinition("expression", "expression");
}
