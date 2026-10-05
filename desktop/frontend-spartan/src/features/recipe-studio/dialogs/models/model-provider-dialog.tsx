import { useT as useUiT } from "@/i18n";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type ReactElement, useMemo, useState } from "react";
import type { ModelProviderConfig } from "../../types";
import {
  MODEL_PROVIDER_TYPE_OPTIONS,
  normalizeModelProviderType,
} from "../../utils/model-provider-types";
import { CollapsibleSectionTriggerButton } from "../shared/collapsible-section-trigger";
import { FieldLabel } from "../shared/field-label";
import { NameField } from "../shared/name-field";

type ModelProviderDialogProps = {
  config: ModelProviderConfig;
  onUpdate: (patch: Partial<ModelProviderConfig>) => void;
};

export function ModelProviderDialog({
  config,
  onUpdate,
}: ModelProviderDialogProps): ReactElement {
  const uiT = useUiT();

  const [optionalOpen, setOptionalOpen] = useState(false);
  const isLocal = config.is_local ?? false;
  const endpointId = `${config.id}-endpoint`;
  const providerTypeId = `${config.id}-provider-type`;
  const apiKeyEnvId = `${config.id}-api-key-env`;
  const apiKeyId = `${config.id}-api-key`;
  const extraHeadersId = `${config.id}-extra-headers`;
  const extraBodyId = `${config.id}-extra-body`;
  const providerType =
    normalizeModelProviderType(config.provider_type) || "openai";
  const providerTypeOptions = useMemo<
    Array<{ value: string; label: string }>
  >(() => {
    if (
      MODEL_PROVIDER_TYPE_OPTIONS.some(
        (option) => option.value === providerType,
      )
    ) {
      return [...MODEL_PROVIDER_TYPE_OPTIONS];
    }
    return [
      { value: providerType, label: providerType },
      ...MODEL_PROVIDER_TYPE_OPTIONS,
    ];
  }, [providerType]);
  const updateField = <K extends keyof ModelProviderConfig>(
    key: K,
    value: ModelProviderConfig[K],
  ) => {
    onUpdate({ [key]: value } as Partial<ModelProviderConfig>);
  };

  return (
    <div className="space-y-4">
      <NameField
        label={uiT("ui.connection_name")}
        value={config.name}
        onChange={(value) => onUpdate({ name: value })}
      />

      {/* Model source toggle */}
      <div className="grid gap-1.5">
        <p className="text-sm font-semibold text-foreground">{uiT("picker.modelSourceAriaLabel")}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              isLocal
                ? "border-ring-strong bg-primary/5"
                : "border-border/60 bg-muted/10 hover:border-border"
            }`}
            onClick={() =>
              onUpdate({
                is_local: true,
                endpoint: "",
                api_key: "",
                api_key_env: "",
                extra_headers: "",
                extra_body: "",
              })
            }
          >
            <p className="text-sm font-semibold text-foreground">{uiT("studio.modelPicker.sourceLocalModel")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {uiT("ui.use_the_model_loaded_in_the_chat_tab")}</p>
          </button>
          <button
            type="button"
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              isLocal
                ? "border-border/60 bg-muted/10 hover:border-border"
                : "border-ring-strong bg-primary/5"
            }`}
            onClick={() => onUpdate({ is_local: false })}
          >
            <p className="text-sm font-semibold text-foreground">
              {uiT("ui.external_endpoint")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {uiT("ui.connect_to_an_api_like_openai_together_or_a_custom_server")}</p>
          </button>
        </div>
      </div>
      {isLocal ? (
        <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{uiT("ui.ready_to_go")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {uiT("ui.recipes_will_use_whatever_model_is_loaded_in_the_chat_tab_when_yo")}</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              {uiT("ui.start_with_the_endpoint_you_want_this_model_to_use")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {uiT("ui.most_connections_only_need_an_endpoint_add_an_api_key_if_that_ser")}</p>
          </div>
          <div className="grid gap-1.5">
            <FieldLabel
              label={uiT("ui.endpoint")}
              htmlFor={endpointId}
              hint="Base URL for the model service or gateway."
            />
            <Input
              id={endpointId}
              className="nodrag"
              placeholder="https://..."
              value={config.endpoint}
              onChange={(event) => updateField("endpoint", event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <FieldLabel
              label={uiT("ui.provider_type")}
              htmlFor={providerTypeId}
              hint="SDK used for API calls. Most providers are OpenAI-compatible."
            />
            <Select
              value={providerType}
              onValueChange={(value) => updateField("provider_type", value)}
            >
              <SelectTrigger id={providerTypeId} className="nodrag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <FieldLabel
              label={uiT("chat.providersDialog.apiKeyOptional")}
              htmlFor={apiKeyId}
              hint="Paste a key here, or use an environment variable below."
            />
            <Input
              id={apiKeyId}
              className="nodrag"
              value={config.api_key ?? ""}
              onChange={(event) => updateField("api_key", event.target.value)}
            />
          </div>
          <Collapsible open={optionalOpen} onOpenChange={setOptionalOpen}>
            <CollapsibleTrigger asChild={true}>
              <CollapsibleSectionTriggerButton
                label={uiT("ui.advanced_request_overrides")}
                open={optionalOpen}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-4">
              <div className="grid gap-1.5">
                <FieldLabel
                  label={uiT("ui.api_key_environment_variable")}
                  htmlFor={apiKeyEnvId}
                  hint="Name of the environment variable that stores the key."
                />
                <Input
                  id={apiKeyEnvId}
                  className="nodrag"
                  placeholder="OPENAI_API_KEY"
                  value={config.api_key_env ?? ""}
                  onChange={(event) =>
                    updateField("api_key_env", event.target.value)
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <FieldLabel
                  label={uiT("ui.extra_headers_json")}
                  htmlFor={extraHeadersId}
                  hint="Optional headers to send with every request."
                />
                <Textarea
                  id={extraHeadersId}
                  className="corner-squircle nodrag"
                  placeholder='{"X-Header": "value"}'
                  value={config.extra_headers ?? ""}
                  onChange={(event) =>
                    updateField("extra_headers", event.target.value)
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <FieldLabel
                  label={uiT("ui.extra_body_json")}
                  htmlFor={extraBodyId}
                  hint="Optional request fields to send every time."
                />
                <Textarea
                  id={extraBodyId}
                  className="corner-squircle nodrag"
                  placeholder='{"key": "value"}'
                  value={config.extra_body ?? ""}
                  onChange={(event) =>
                    updateField("extra_body", event.target.value)
                  }
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
