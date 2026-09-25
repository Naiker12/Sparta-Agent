import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExternalModelOption } from "@/features/model-picker";
import { cn } from "@/lib/utils";

type ApiProviderModelSelectorProps = {
  models: ExternalModelOption[];
  value: string;
  onValueChange: (value: string) => void;
  onConfigureProviders?: () => void;
  className?: string;
  triggerDataTour?: string;
};

/**
 * Model picker for API-only installations.
 *
 * Keeping this separate from the legacy model picker is deliberate: the latter
 * owns the Hub, GGUF, download and on-device inventory views, none of which
 * exists in an API-provider build.
 */
export function ApiProviderModelSelector({
  models,
  value,
  onValueChange,
  onConfigureProviders,
  className,
  triggerDataTour,
}: ApiProviderModelSelectorProps) {
  const selected = models.some((model) => model.id === value) ? value : "";

  if (models.length === 0) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onConfigureProviders}
        className={cn("max-w-[260px]", className)}
        data-tour={triggerDataTour}
      >
        Configurar proveedor API
      </Button>
    );
  }

  return (
    <Select value={selected} onValueChange={onValueChange}>
      <SelectTrigger
        size="sm"
        className={cn("max-w-[260px]", className)}
        data-tour={triggerDataTour}
        aria-label="Modelo del proveedor API"
      >
        <SelectValue placeholder="Selecciona un modelo API" />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.providerName}: {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
