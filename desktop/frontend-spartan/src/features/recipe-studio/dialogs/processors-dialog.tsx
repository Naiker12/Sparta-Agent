import { useT as useUiT } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { VisuallyHidden } from "radix-ui";
import { type ReactElement, useMemo } from "react";
import type { RecipeProcessorConfig } from "../types";
import { buildDefaultSchemaTransform } from "../utils/processors";
import { AvailableVariables } from "./shared/available-variables";
import { FieldLabel } from "./shared/field-label";
type ProcessorsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processors: RecipeProcessorConfig[];
  onProcessorsChange: (processors: RecipeProcessorConfig[]) => void;
  container?: HTMLDivElement | null;
};

export function ProcessorsDialog({
  open,
  onOpenChange,
  processors,
  onProcessorsChange,
  container,
}: ProcessorsDialogProps): ReactElement {
  const uiT = useUiT();

  const schemaIndex = useMemo(
    () =>
      processors.findIndex(
        (processor) => processor.processor_type === "schema_transform",
      ),
    [processors],
  );
  const schemaProcessor = schemaIndex >= 0 ? processors[schemaIndex] : null;
  const nameId = schemaProcessor
    ? `${schemaProcessor.id}-name`
    : "schema-transform-name";
  const templateId = schemaProcessor
    ? `${schemaProcessor.id}-template`
    : "schema-transform-template";

  const setSchemaEnabled = (enabled: boolean) => {
    if (enabled) {
      if (schemaProcessor) {
        return;
      }
      onProcessorsChange([...processors, buildDefaultSchemaTransform()]);
      return;
    }
    onProcessorsChange(
      processors.filter(
        (processor) => processor.processor_type !== "schema_transform",
      ),
    );
  };

  const updateSchema = (patch: Partial<RecipeProcessorConfig>) => {
    if (!schemaProcessor) {
      return;
    }
    const next = [...processors];
    next[schemaIndex] = { ...schemaProcessor, ...patch };
    onProcessorsChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        container={container}
        position="absolute"
        overlayPosition="absolute"
        overlayClassName="bg-transparent"
        className="corner-squircle max-h-[650px] overflow-auto sm:max-w-2xl shadow-border"
      >
        <VisuallyHidden.Root>
          <DialogTitle>{uiT("ui.processors")}</DialogTitle>
        </VisuallyHidden.Root>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 corner-squircle rounded-2xl border border-border/60 px-3 py-2">
            <div>
              <p className="text-sm font-semibold">{uiT("ui.schema_transform")}</p>
              <p className="text-xs text-muted-foreground">
                {uiT("ui.transform_final_rows_to_target_schema_post_batch")}</p>
            </div>
            <Switch
              checked={Boolean(schemaProcessor)}
              onCheckedChange={setSchemaEnabled}
            />
          </div>

          {schemaProcessor && (
            <div className="space-y-3">
              <AvailableVariables configId="" />
              <div className="grid gap-1.5">
                <FieldLabel
                  label={uiT("projectsPage.colName")}
                  htmlFor={nameId}
                  hint="Processor name shown in graph and payload."
                />
                <Input
                  id={nameId}
                  className="nodrag"
                  value={schemaProcessor.name}
                  onChange={(event) =>
                    updateSchema({ name: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <FieldLabel
                  label={uiT("ui.template_json")}
                  htmlFor={templateId}
                  hint="Target output schema template using Jinja references."
                />
                <Textarea
                  id={templateId}
                  className="corner-squircle nodrag min-h-[220px]"
                  value={schemaProcessor.template}
                  onChange={(event) =>
                    updateSchema({ template: event.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {uiT("ui.use_jinja_refs_like")}{" "}{"{{ customer_review }}"} {" "}{uiT("ui.in_values")}</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {uiT("tour.done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
