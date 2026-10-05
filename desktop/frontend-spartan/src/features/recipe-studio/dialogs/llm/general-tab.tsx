import { useT as useUiT } from "@/i18n";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactElement, type RefObject, useMemo, useRef } from "react";
import { useRecipeStudioStore } from "../../stores/recipe-studio";
import type { LlmConfig } from "../../types";
import { isLikelyImageValue } from "../../utils/image-preview";
import { findInvalidJinjaReferences } from "../../utils/refs";
import { getAvailableVariables } from "../../utils/variables";
import { AvailableVariables } from "../shared/available-variables";
import { CollapsibleSectionTriggerButton } from "../shared/collapsible-section-trigger";
import { FieldLabel } from "../shared/field-label";
import { NameField } from "../shared/name-field";

const CODE_LANG_OPTIONS = [
  "python",
  "javascript",
  "typescript",
  "java",
  "kotlin",
  "go",
  "rust",
  "ruby",
  "scala",
  "swift",
  "sql:sqlite",
  "sql:postgres",
  "sql:mysql",
  "sql:tsql",
  "sql:bigquery",
  "sql:ansi",
];

const TRACE_MODE_OPTIONS = ["none", "last_message", "all_messages"] as const;

function normalizeTraceMode(value: string): LlmConfig["with_trace"] {
  if (value === "last_message" || value === "all_messages") {
    return value;
  }
  return "none";
}

type LlmGeneralTabProps = {
  config: LlmConfig;
  modelConfigAliases: string[];
  modelProviderOptions: string[];
  toolProfileAliases: string[];
  modelAliasAnchorRef: RefObject<HTMLDivElement | null>;
  onUpdate: (patch: Partial<LlmConfig>) => void;
};

export function LlmGeneralTab({
  config,
  modelConfigAliases,
  modelProviderOptions,
  toolProfileAliases,
  modelAliasAnchorRef,
  onUpdate,
}: LlmGeneralTabProps): ReactElement {
  const uiT = useUiT();

  const configs = useRecipeStudioStore((state) => state.configs);
  const modelAliasId = `${config.id}-model-alias`;
  const toolAliasId = `${config.id}-tool-alias`;
  const codeLangId = `${config.id}-code-lang`;
  const promptId = `${config.id}-prompt`;
  const outputFormatId = `${config.id}-output-format`;
  const systemPromptId = `${config.id}-system-prompt`;
  const hasModelConfigs = modelConfigAliases.length > 0;
  const hasModelProviders = modelProviderOptions.length > 0;
  const hasToolProfiles = toolProfileAliases.length > 0;
  const validReferences = useMemo(
    () => getAvailableVariables(configs, config.id),
    [configs, config.id],
  );
  const invalidPromptRefs = useMemo(
    () => findInvalidJinjaReferences(config.prompt, validReferences),
    [config.prompt, validReferences],
  );
  const invalidSystemRefs = useMemo(
    () => findInvalidJinjaReferences(config.system_prompt, validReferences),
    [config.system_prompt, validReferences],
  );
  const invalidPromptText = invalidPromptRefs
    .slice(0, 3)
    .map((ref) => `{{ ${ref} }}`)
    .join(", ");
  const invalidSystemText = invalidSystemRefs
    .slice(0, 3)
    .map((ref) => `{{ ${ref} }}`)
    .join(", ");
  const seedConfig = useMemo(
    () => Object.values(configs).find((item) => item.kind === "seed"),
    [configs],
  );
  const hasHfSeed = Boolean(
    seedConfig && (seedConfig.seed_source_type ?? "hf") === "hf",
  );
  const seedColumns = useMemo(
    () => seedConfig?.seed_columns ?? [],
    [seedConfig],
  );
  const seedPreviewRows = useMemo(
    () => seedConfig?.seed_preview_rows ?? [],
    [seedConfig],
  );
  const imageColumnOptions = useMemo(() => {
    if (seedColumns.length === 0) {
      return [];
    }
    const detected = seedColumns.filter((columnName) => {
      const lower = columnName.toLowerCase();
      if (
        lower.includes("image") ||
        lower.includes("img") ||
        lower.includes("photo") ||
        lower.includes("picture") ||
        lower.includes("base64") ||
        lower.includes("url")
      ) {
        return true;
      }
      return seedPreviewRows.some((row) => isLikelyImageValue(row[columnName]));
    });
    return detected.length > 0 ? detected : seedColumns;
  }, [seedColumns, seedPreviewRows]);
  const imageContext = config.image_context ?? {
    enabled: false,
    // biome-ignore lint/style/useNamingConvention: api schema
    column_name: "",
  };
  const imageContextToggleId = `${config.id}-image-context-enabled`;
  const imageContextColumnId = `${config.id}-image-context-column`;
  const imageContextColumnOptions = useMemo(() => {
    const preferred =
      imageColumnOptions.length > 0 ? imageColumnOptions : seedColumns;
    const deduped = Array.from(
      new Set(preferred.map((value) => value.trim()).filter(Boolean)),
    );
    const selected = imageContext.column_name.trim();
    if (selected && !deduped.includes(selected)) {
      deduped.unshift(selected);
    }
    return deduped;
  }, [imageColumnOptions, imageContext.column_name, seedColumns]);
  const traceModeId = `${config.id}-trace-mode`;
  const reasoningToggleId = `${config.id}-reasoning-content`;
  const advancedOpen = config.advancedOpen === true;
  const toolAliasAnchorRef = useRef<HTMLDivElement>(null);
  const needsSetupHelp = !(hasModelConfigs && hasModelProviders);
  const needsModelChoice = !config.model_alias?.trim();

  return (
    <div className="space-y-4">
      <NameField
        value={config.name}
        onChange={(value) => onUpdate({ name: value })}
      />
      {needsSetupHelp ? (
        <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
          <p className="text-sm font-semibold text-foreground">
            {uiT("ui.set_up_the_model_once_then_come_back_here")}</p>
          <div className="mt-2 space-y-1.5">
            {!hasModelProviders && (
              <p className="flex items-start gap-2">
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="mt-0.5 size-3.5 shrink-0 text-primary"
                />
                <span>
                  {uiT("ui.add_a_provider_connection_step_in_ai_generation_setup")}</span>
              </p>
            )}
            {!hasModelConfigs && (
              <p className="flex items-start gap-2">
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="mt-0.5 size-3.5 shrink-0 text-primary"
                />
                <span>
                  {uiT("ui.add_a_model_preset_step_connect_it_then_choose_it_below")}</span>
              </p>
            )}
          </div>
        </div>
      ) : needsModelChoice ? (
        <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
          <p className="text-sm font-semibold text-foreground">
            {uiT("ui.start_by_choosing_a_model_preset")}</p>
          <p className="mt-1">
            {uiT("ui.once_that_is_in_place_write_the_prompt_and_add_optional_tool_acce")}</p>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <FieldLabel
          label={uiT("ui.model_preset")}
          htmlFor={modelAliasId}
          hint="Choose the reusable model setup for this step."
        />
        <div ref={modelAliasAnchorRef}>
          <Combobox
            items={modelConfigAliases}
            filteredItems={modelConfigAliases}
            filter={null}
            value={config.model_alias || null}
            onValueChange={(value) => onUpdate({ model_alias: value ?? "" })}
            itemToStringValue={(value) => value}
            autoHighlight={true}
          >
            <ComboboxInput
              id={modelAliasId}
              className="nodrag w-full"
              placeholder={uiT("ui.choose_a_model_preset")}
              onBlur={(event) => {
                const inputValue = event.target.value;
                if (inputValue !== config.model_alias) {
                  onUpdate({ model_alias: inputValue });
                }
              }}
            />
            <ComboboxContent anchor={modelAliasAnchorRef}>
              <ComboboxEmpty>{uiT("ui.no_model_configs_found")}</ComboboxEmpty>
              <ComboboxList>
                {(alias: string) => (
                  <ComboboxItem key={alias} value={alias}>
                    {alias}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </div>
      {!hasToolProfiles && (
        <p className="text-xs text-muted-foreground">
          {uiT("ui.need_tools_for_this_step_add_a_tool_access_step_in_ai_generation_")}</p>
      )}
      {(hasToolProfiles || Boolean(config.tool_alias?.trim())) && (
        <div className="grid gap-1.5">
          <FieldLabel
            label={uiT("ui.tool_access_optional")}
            htmlFor={toolAliasId}
            hint="Choose saved tool access for this step. Leave empty if this step should not use tools."
          />
          <div ref={toolAliasAnchorRef}>
            <Combobox
              items={toolProfileAliases}
              filteredItems={toolProfileAliases}
              filter={null}
              value={config.tool_alias || null}
              onValueChange={(value) => onUpdate({ tool_alias: value ?? "" })}
              itemToStringValue={(value) => value}
              autoHighlight={true}
            >
              <ComboboxInput
                id={toolAliasId}
                className="nodrag w-full"
                placeholder={uiT("ui.choose_tool_access")}
                onBlur={(event) => {
                  const inputValue = event.target.value;
                  if (inputValue !== (config.tool_alias ?? "")) {
                    onUpdate({ tool_alias: inputValue });
                  }
                }}
              />
              <ComboboxContent anchor={toolAliasAnchorRef}>
                <ComboboxEmpty>{uiT("ui.no_tool_access_found")}</ComboboxEmpty>
                <ComboboxList>
                  {(alias: string) => (
                    <ComboboxItem key={alias} value={alias}>
                      {alias}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </div>
      )}
      {config.llm_type === "code" && (
        <div className="grid gap-1.5">
          <FieldLabel
            label={uiT("ui.code_language")}
            htmlFor={codeLangId}
            hint="Choose the language this AI step should generate."
          />
          <Select
            value={config.code_lang ?? "python"}
            onValueChange={(value) => onUpdate({ code_lang: value })}
          >
            <SelectTrigger className="nodrag w-full" id={codeLangId}>
              <SelectValue placeholder={uiT("ui.select_language")} />
            </SelectTrigger>
            <SelectContent>
              {CODE_LANG_OPTIONS.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid gap-1.5">
        <FieldLabel
          label={uiT("chat.timing.prompt")}
          htmlFor={promptId}
          hint="Write the prompt for this step. Insert other fields with {{ field_name }}."
        />
        <Textarea
          id={promptId}
          className="corner-squircle nodrag max-h-[450px] overflow-auto"
          aria-invalid={invalidPromptRefs.length > 0}
          value={config.prompt}
          onChange={(event) => onUpdate({ prompt: event.target.value })}
        />
        {invalidPromptRefs.length > 0 && (
          <p className="text-xs text-destructive">
            {uiT("ui.unknown_field")}{" "}{invalidPromptText}
            {invalidPromptRefs.length > 3
              ? ` +${invalidPromptRefs.length - 3} more`
              : ""}
          </p>
        )}
      </div>
      <AvailableVariables configId={config.id} />
      {hasHfSeed && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabel
              label={uiT("ui.use_image_context")}
              htmlFor={imageContextToggleId}
              hint="Attach one image field from your source data to this AI step."
            />
            <Switch
              id={imageContextToggleId}
              checked={imageContext.enabled}
              onCheckedChange={(checked) => {
                onUpdate({
                  image_context: {
                    ...imageContext,
                    enabled: checked,
                    // biome-ignore lint/style/useNamingConvention: api schema
                    column_name:
                      checked && !imageContext.column_name
                        ? (imageContextColumnOptions[0] ?? "")
                        : imageContext.column_name,
                  },
                });
              }}
            />
          </div>
          {imageContext.enabled && (
            <div className="grid gap-1.5">
              <FieldLabel
                label={uiT("ui.image_field")}
                htmlFor={imageContextColumnId}
                hint="Choose the source-data field that contains the image."
              />
              <Select
                value={imageContext.column_name || undefined}
                onValueChange={(value) =>
                  onUpdate({
                    image_context: {
                      ...imageContext,
                      // biome-ignore lint/style/useNamingConvention: api schema
                      column_name: value,
                    },
                  })
                }
              >
                <SelectTrigger
                  className="nodrag w-full"
                  id={imageContextColumnId}
                >
                  <SelectValue placeholder={uiT("ui.select_image_column")} />
                </SelectTrigger>
                <SelectContent>
                  {imageContextColumnOptions.map((columnName) => (
                    <SelectItem key={columnName} value={columnName}>
                      {columnName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
      {config.llm_type === "structured" && (
        <div className="grid gap-1.5">
          <FieldLabel
            label={uiT("ui.response_format")}
            htmlFor={outputFormatId}
            hint="Describe the JSON shape you want back."
          />
          <Textarea
            id={outputFormatId}
            className="corner-squircle nodrag"
            value={config.output_format ?? ""}
            onChange={(event) =>
              onUpdate({ output_format: event.target.value })
            }
          />
        </div>
      )}
      <Collapsible
        open={advancedOpen}
        onOpenChange={(open) => onUpdate({ advancedOpen: open })}
      >
        <CollapsibleTrigger asChild={true}>
          <CollapsibleSectionTriggerButton
            label={uiT("ui.trace_and_extra_controls")}
            open={advancedOpen}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4">
          <div className="grid gap-1.5">
            <FieldLabel
              label={uiT("ui.instructions_optional")}
              htmlFor={systemPromptId}
              hint="Add extra guidance that should apply before the prompt."
            />
            <Textarea
              id={systemPromptId}
              className="corner-squircle nodrag max-h-[450px] overflow-auto"
              aria-invalid={invalidSystemRefs.length > 0}
              value={config.system_prompt}
              onChange={(event) =>
                onUpdate({ system_prompt: event.target.value })
              }
            />
            {invalidSystemRefs.length > 0 && (
              <p className="text-xs text-destructive">
                {uiT("ui.unknown_field")}{" "}{invalidSystemText}
                {invalidSystemRefs.length > 3
                  ? ` +${invalidSystemRefs.length - 3} more`
                  : ""}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <FieldLabel
              label={uiT("ui.save_trace_details")}
              htmlFor={traceModeId}
              hint="Adds a trace field you can inspect later."
            />
            <Select
              value={config.with_trace ?? "none"}
              onValueChange={(value) =>
                onUpdate({
                  // biome-ignore lint/style/useNamingConvention: api schema
                  with_trace: normalizeTraceMode(value),
                })
              }
            >
              <SelectTrigger className="nodrag w-full" id={traceModeId}>
                <SelectValue placeholder={uiT("ui.select_trace_mode")} />
              </SelectTrigger>
              <SelectContent>
                {TRACE_MODE_OPTIONS.map((traceMode) => (
                  <SelectItem key={traceMode} value={traceMode}>
                    {traceMode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel
              label={uiT("ui.save_reasoning_text")}
              htmlFor={reasoningToggleId}
              hint="Adds a reasoning field when the model returns one."
            />
            <Switch
              id={reasoningToggleId}
              checked={config.extract_reasoning_content === true}
              onCheckedChange={(checked) =>
                onUpdate({
                  // biome-ignore lint/style/useNamingConvention: api schema
                  extract_reasoning_content: checked,
                })
              }
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
