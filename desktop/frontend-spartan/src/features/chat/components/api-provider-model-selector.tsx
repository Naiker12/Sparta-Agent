import { translate as uiTranslate } from "@/i18n";
import { useT as useUiT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ExternalModelOption } from "@/features/model-picker";
import { ApiProviderLogo } from "../api-provider-logo";
import { listProviderModels, updateProviderConfig } from "../api/providers-api";
import { buildExternalModelId, parseExternalModelId, toExternalBackendProviderType } from "../external-providers";
import { useExternalProvidersStore } from "../stores/external-providers-store";
import { saveReasoningCatalog } from "../catalog-reasoning";
import { externalModelLabel } from "../lib/external-model-label";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, RefreshCw, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "@/lib/toast";

type Props = {
  models: ExternalModelOption[];
  value: string;
  onValueChange: (value: string) => void;
  onConfigureProviders?: () => void;
  className?: string;
  triggerDataTour?: string;
};

export function ApiProviderModelSelector({ models, value, onValueChange, onConfigureProviders, className, triggerDataTour }: Props) {
  const uiT = useUiT();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const providers = useExternalProvidersStore(s => s.providers);
  const connectionsEnabled = useExternalProvidersStore(s => s.connectionsEnabled);
  const connected = connectionsEnabled ? providers : [];
  const options = useMemo(() => {
    const all = new Map(models.map(m => [m.id, m]));
    for (const p of connected) for (const name of [...p.models, ...(p.availableModels ?? [])]) {
      const id = buildExternalModelId(p.id, name);
      if (!all.has(id)) all.set(id, { id, name, providerId: p.id, providerName: p.name, providerType: p.providerType });
    }
    return [...all.values()];
  }, [models, providers, connectionsEnabled]);
  const selected = options.find(m => m.id === value);
  const selectedLabel = selected?.name ?? externalModelLabel(value);
  const groups = [...new Set(options.map(m => m.providerId))];

  async function refresh() {
    if (loading) return;
    setLoading(true);
    const results = await Promise.allSettled(connected.map(async p => {
      const catalog = await listProviderModels({ providerType: p.backendProviderType ?? toExternalBackendProviderType(p.providerType), providerId: p.id, apiKey: "", baseUrl: p.baseUrl });
      saveReasoningCatalog(p.providerType, catalog);
      const current = useExternalProvidersStore.getState();
      current.setProviders(current.providers.map(row => row.id === p.id ? { ...row, availableModels: catalog.map(m => m.id) } : row));
    }));
    if (results.some(r => r.status === "rejected")) toast.error(uiTranslate("ui.could_not_refresh_a_catalog_use_the_saved_models_or_check_the_con"));
    setLoaded(true);
    setLoading(false);
  }

  async function choose(model: ExternalModelOption) {
    if (saving) return;
    const provider = providers.find(p => p.id === model.providerId);
    const modelId = parseExternalModelId(model.id)?.modelId;
    setSaving(true);
    try {
      if (provider && modelId && !provider.models.includes(modelId)) {
        const enabled = [...provider.models, modelId];
        await updateProviderConfig(provider.id, { models: enabled, availableModels: provider.availableModels });
        const current = useExternalProvidersStore.getState();
        current.setProviders(current.providers.map(p => p.id === provider.id ? { ...p, models: enabled } : p));
      }
      onValueChange(model.id);
      setOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo seleccionar el modelo."); }
    finally { setSaving(false); }
  }

  if (!options.length && !connected.length && !selectedLabel) return <Button variant="ghost" size="sm" onClick={onConfigureProviders} disabled={!onConfigureProviders} aria-label={uiT("ui.choose_an_api_provider_to_start_chatting")}>{uiT("ui.choose_provider")}</Button>;

  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next && !loaded) void refresh(); }}>
    <PopoverTrigger asChild><Button variant="ghost" size="sm" className={cn("composer-model-selector min-w-0 max-w-[180px] rounded-full", className)} data-tour={triggerDataTour} aria-label={uiT("studio.modelPicker.selectModel")} title={selected ? `${selected.providerName}: ${selected.name}` : selectedLabel ?? uiT("studio.modelPicker.selectModel")} disabled={saving}>
      {selected && <ApiProviderLogo providerType={selected.providerType} className="size-4 shrink-0" />}
      <span className="min-w-0 truncate">{selectedLabel?.replace(/^[^/:]+[:/]/, "") ?? uiT("studio.modelPicker.selectModel")}</span><ChevronDown className="shrink-0" data-icon="inline-end" />
    </Button></PopoverTrigger>
    <PopoverContent side="top" align="end" sideOffset={8} className="w-[min(360px,calc(100vw-32px))] gap-0 overflow-hidden rounded-2xl border p-0 shadow-xl">
      <Command>
        <CommandInput placeholder={uiT("ui.search_model_or_provider")} />
        <CommandList className="max-h-80">
          <CommandEmpty>{loading ? uiT("picker.loadingModels") : uiT("ui.no_matching_models")}</CommandEmpty>
          {groups.map(id => { const rows = options.filter(m => m.providerId === id); return <CommandGroup key={id} heading={rows[0]?.providerName}>
            {rows.map(m => <CommandItem key={m.id} value={`${m.providerName} ${m.name} ${m.id}`} disabled={saving} onSelect={() => void choose(m)} className="gap-3 py-2.5">
              <ApiProviderLogo providerType={m.providerType} className="size-4" />
              <span className="min-w-0 flex-1 truncate" title={m.name}>{m.name}</span>
              {m.id === value && <Check className="size-4 shrink-0" />}
            </CommandItem>)}
          </CommandGroup>; })}
        </CommandList>
      </Command>
      <div className="flex items-center justify-between gap-2 border-t p-2">
        <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading || saving}><RefreshCw data-icon="inline-start" className={cn(loading && "animate-spin")} />{loading ? uiT("ui.updating") : uiT("update.update")}</Button>
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); onConfigureProviders?.(); }} disabled={!onConfigureProviders}><Settings2 data-icon="inline-start" />{uiT("ui.providers")}</Button>
      </div>
    </PopoverContent>
  </Popover>;
}
