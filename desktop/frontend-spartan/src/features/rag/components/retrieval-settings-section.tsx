import { useT as useUiT } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type RagAutoInject,
  type RagMode,
  useChatRuntimeStore,
} from "@/features/chat/stores/chat-runtime-store";
import { cn } from "@/lib/utils";
import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";

const MODE_LABEL: Record<RagMode, string> = {
  hybrid: "Hybrid",
  dense: "Semantic only",
  lexical: "BM25 only",
};

function InfoHint({ children }: { children: ReactNode }) {
  const uiT = useUiT();

  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>
        <button
          type="button"
          aria-label={uiT("ui.more_info")}
          className="text-muted-foreground/50 hover:text-muted-foreground"
        >
          <InfoIcon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
  format = (v: number) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  format?: (v: number) => string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-ui-13 font-medium leading-[1.25] tracking-nav text-nav-fg">
          {label}
        </span>
        <span className="text-ui-13 tabular-nums text-muted-foreground">
          {format(value)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
        className="panel-slider"
      />
    </div>
  );
}

// Retrieval settings; the source itself is picked from the composer dropdown.
export function RetrievalSettingsSection() {
  const uiT = useUiT();

  const ragMode = useChatRuntimeStore((s) => s.ragMode);
  const setRagMode = useChatRuntimeStore((s) => s.setRagMode);
  const ragTopK = useChatRuntimeStore((s) => s.ragTopK);
  const setRagTopK = useChatRuntimeStore((s) => s.setRagTopK);
  const ragAutoInject = useChatRuntimeStore((s) => s.ragAutoInject);
  const setRagAutoInject = useChatRuntimeStore((s) => s.setRagAutoInject);
  const ragAutoInjectMinScore = useChatRuntimeStore(
    (s) => s.ragAutoInjectMinScore,
  );
  const setRagAutoInjectMinScore = useChatRuntimeStore(
    (s) => s.setRagAutoInjectMinScore,
  );
  const ragOcrScanned = useChatRuntimeStore((s) => s.ragOcrScanned);
  const setRagOcrScanned = useChatRuntimeStore((s) => s.setRagOcrScanned);
  const ragCaptionFigures = useChatRuntimeStore((s) => s.ragCaptionFigures);
  const setRagCaptionFigures = useChatRuntimeStore(
    (s) => s.setRagCaptionFigures,
  );

  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="flex flex-col gap-2">
        <span className="text-ui-13 font-medium leading-[1.25] tracking-nav text-nav-fg">
          {uiT("ui.search_mode")}</span>
        <Select
          value={ragMode}
          onValueChange={(value) => setRagMode(value as RagMode)}
        >
          <SelectTrigger
            className="panel-select-trigger h-8 w-full"
            aria-label={uiT("ui.search_mode")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hybrid">{MODE_LABEL.hybrid}</SelectItem>
            <SelectItem value="dense">{MODE_LABEL.dense}</SelectItem>
            <SelectItem value="lexical">{MODE_LABEL.lexical}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-ui-13 font-medium leading-[1.25] tracking-nav text-nav-fg">
            {uiT("ui.passages_top_k")}</span>
          <span className="text-ui-13 tabular-nums text-muted-foreground">
            {ragTopK}
          </span>
        </div>
        <Slider
          value={[ragTopK]}
          min={1}
          max={20}
          step={1}
          onValueChange={([value]) => setRagTopK(value)}
          aria-label={uiT("ui.number_of_passages_to_retrieve")}
          className="panel-slider"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="flex items-center gap-1.5 text-ui-13 font-medium leading-[1.25] tracking-nav text-nav-fg">
            {uiT("ui.auto_retrieve_documents")}<InfoHint>
              {uiT("ui.auto_turns_retrieval_on_for_smaller_models_9b_and_below_which_ten")}</InfoHint>
          </span>
          <span className="text-ui-12 leading-[1.3] text-muted-foreground">
            {uiT("ui.search_attached_documents_before_answering")}</span>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={ragAutoInject}
          onValueChange={(value) => {
            // Radix clears on re-click; ignore empty so one stays selected.
            if (value) {
              setRagAutoInject(value as RagAutoInject);
            }
          }}
          className="w-full"
          aria-label={uiT("ui.auto_retrieve_documents")}
        >
          <ToggleGroupItem value="auto" className="flex-1">
            {uiT("studio.dataset.auto")}</ToggleGroupItem>
          <ToggleGroupItem value="on" className="flex-1">
            {uiT("settings.appearance.custom.reduceMotion.on")}</ToggleGroupItem>
          <ToggleGroupItem value="off" className="flex-1">
            {uiT("settings.chat.pastedTextThresholdOff")}</ToggleGroupItem>
        </ToggleGroup>
        <SliderRow
          label={uiT("ui.auto_retrieve_threshold")}
          value={ragAutoInjectMinScore}
          min={0}
          max={1}
          step={0.05}
          disabled={ragAutoInject === "off"}
          onChange={setRagAutoInjectMinScore}
          format={(v) => v.toFixed(2)}
        />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="flex items-center gap-1.5 text-ui-13 font-medium leading-[1.25] tracking-nav text-nav-fg">
            {uiT("ui.ocr_scanned_pages")}<InfoHint>
              {uiT("ui.read_text_off_scanned_or_image_only_pdf_pages_with_the_loaded_mod")}</InfoHint>
          </span>
          <span className="text-ui-12 leading-[1.3] text-muted-foreground">
            {uiT("ui.transcribe_image_only_pdf_pages_when_attaching")}</span>
        </div>
        <Switch
          checked={ragOcrScanned}
          onCheckedChange={setRagOcrScanned}
          aria-label={uiT("ui.ocr_scanned_pages")}
          className="mt-0.5"
        />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="flex items-center gap-1.5 text-ui-13 font-medium leading-[1.25] tracking-nav text-nav-fg">
            {uiT("ui.describe_figures_amp_charts")}<InfoHint>
              {uiT("ui.caption_pdf_figures_charts_tables_and_diagrams_at_upload_with_the")}</InfoHint>
          </span>
          <span className="text-ui-12 leading-[1.3] text-muted-foreground">
            {uiT("ui.read_charts_and_diagrams_when_attaching")}</span>
        </div>
        <Switch
          checked={ragCaptionFigures}
          onCheckedChange={setRagCaptionFigures}
          aria-label={uiT("ui.describe_figures_and_charts")}
          className="mt-0.5"
        />
      </div>
    </div>
  );
}
