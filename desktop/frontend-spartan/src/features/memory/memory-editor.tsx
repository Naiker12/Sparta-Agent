import { useMemoryT as useUiT } from "./memory-i18n";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  MEMORY_TYPES,
  type MemoryInput,
  type MemoryNode,
} from "./memory-types";

export function MemoryEditor({
  node,
  projectId,
  saving,
  onSave,
  onClose,
}: {
  node?: MemoryNode;
  projectId?: string;
  saving: boolean;
  onSave: (data: MemoryInput, id?: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const uiT = useUiT();

  const [label, setLabel] = useState(node?.label ?? "");
  const [content, setContent] = useState(node?.content ?? "");
  const [type, setType] = useState(node?.type ?? "fact");
  return (
    <section
      className="flex flex-col gap-6 p-5"
      aria-label={uiT("ui.memory_editor")}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          {node ? uiT("ui.edit_memory") : uiT("ui.add_memory")}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={onClose}
          aria-label={uiT("ui.close_editor")}
        >
          ×
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {uiT("ui.save_useful_information_for_future_conversations")}
      </p>
      <form
        className="flex flex-col gap-6"
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await onSave(
              {
                type,
                label: label.trim(),
                content: content.trim(),
                projectId: node?.projectId ?? projectId,
              },
              node?.id,
            )
          )
            onClose();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="memory-kind">
              {uiT("ui.memory_type")}
            </FieldLabel>
            <select
              id="memory-kind"
              value={type}
              disabled={saving}
              onChange={(event) => setType(event.target.value)}
              className="h-10 rounded-xl border bg-background px-3 text-sm"
            >
              {Object.entries(MEMORY_TYPES)
                .filter(([key]) => key !== "episode")
                .map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="memory-title">{uiT("ui.title")}</FieldLabel>
            <Input
              id="memory-title"
              required
              maxLength={300}
              value={label}
              disabled={saving}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={uiT("ui.for_example_preferred_language")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="memory-content">
              {uiT("ui.content")}
            </FieldLabel>
            <Textarea
              id="memory-content"
              required
              maxLength={10000}
              rows={7}
              value={content}
              disabled={saving}
              onChange={(event) => setContent(event.target.value)}
              placeholder={uiT("ui.what_should_spartan_agent_remember")}
            />
          </Field>
        </FieldGroup>
        <Button
          type="submit"
          disabled={saving || !label.trim() || !content.trim()}
        >
          {saving ? uiT("ui.saving") : uiT("ui.save_memory")}
        </Button>
      </form>
    </section>
  );
}
