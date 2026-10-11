import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiProviderLogo } from "@/features/chat";
import type { ExternalProviderConfig } from "@/features/chat";
import { useT } from "@/i18n";

export function AutomationModelFields({
  providers,
  providerId,
  model,
  disabled,
  prefix,
  onProviderChange,
  onModelChange,
}: {
  providers: ExternalProviderConfig[];
  providerId: string;
  model: string;
  disabled: boolean;
  prefix: string;
  onProviderChange: (id: string) => void;
  onModelChange: (model: string) => void;
}) {
  const t = useT();
  const provider = providers.find((item) => item.id === providerId);
  const models = provider?.models.length
    ? provider.models
    : (provider?.availableModels ?? []);
  return (
    <>
      <Field data-disabled={disabled}>
        <FieldLabel htmlFor={`${prefix}-provider`}>
          {t("ui.automation_schedule_provider")}
        </FieldLabel>
        <Select
          value={providerId}
          disabled={disabled}
          onValueChange={onProviderChange}
        >
          <SelectTrigger id={`${prefix}-provider`}>
            <SelectValue placeholder={t("ui.choose_api_provider")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {providers.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <ApiProviderLogo
                    providerType={item.providerType}
                    className="size-4"
                  />
                  {item.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field data-disabled={disabled || !provider}>
        <FieldLabel htmlFor={`${prefix}-model`}>
          {t("studio.progress.model")}
        </FieldLabel>
        <Select
          value={model}
          disabled={disabled || !provider}
          onValueChange={onModelChange}
        >
          <SelectTrigger id={`${prefix}-model`}>
            <SelectValue placeholder={t("ui.choose_model")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {models.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription>
          {t("ui.automation_model_saved_on_activation")}
        </FieldDescription>
      </Field>
    </>
  );
}
