import { useContext, useId, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { PanelControlsContext } from "./panel-controls";
import { readFormDraft, writeFormDraft, removeFormDraft } from "./form-drafts";
import {
  validateFormValues,
  type FormBlock,
  type ResponsePanel,
} from "./panels";

function PanelForm({ form }: { form: FormBlock }) {
  const t = useT();
  const prefix = useId();
  const controls = useContext(PanelControlsContext);
  const [values, setValues] = useState<Record<string, unknown>>(() => readFormDraft(controls?.draftScope, form));
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const inFlight = useRef(false);
  const submitted = controls?.submitted.has(form.id) ?? false;
  const displayValues = controls?.submittedValues.get(form.id) ?? values;
  const disabled = !controls || controls.disabled || sending || submitted;
  const update = (id: string, value: unknown) => {
    const next = { ...values, [id]: value };
    setValues(next);
    writeFormDraft(controls?.draftScope, form, next);
    setErrors((previous) => previous.filter((key) => key !== id));
    setSendError(false);
  };
  return (
    <form
      autoComplete="off"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled || inFlight.current || !controls) return;
        const validated = validateFormValues(form, values);
        setErrors(validated.errors);
        if (validated.errors.length) return;
        inFlight.current = true;
        setSending(true);
        setSendError(false);
        try {
          await controls.onSubmit(form, validated.values);
          removeFormDraft(controls.draftScope, form);
        } catch {
          setSendError(true);
        } finally {
          inFlight.current = false;
          setSending(false);
        }
      }}
    >
      <Card size="sm">
        <CardHeader>
          <CardTitle>{form.title}</CardTitle>
          <CardDescription>{t("chat.responseUi.formNotice")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {form.fields.map((field) => {
              const id = `${prefix}-${field.id}`;
              const invalid = errors.includes(field.id);
              const describedBy = invalid ? `${id}-error` : undefined;
              const common = {
                id,
                disabled,
                "aria-invalid": invalid,
                "aria-describedby": describedBy,
                "aria-required": field.required,
              };
              return (
                <Field
                  key={field.id}
                  orientation={
                    field.type === "checkbox" ? "horizontal" : "vertical"
                  }
                  data-invalid={invalid}
                  data-disabled={disabled}
                >
                  <FieldLabel htmlFor={id}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </FieldLabel>
                  {field.type === "select" ? (
                    <Select
                      disabled={disabled}
                      value={String(displayValues[field.id] ?? "")}
                      onValueChange={(value) => update(field.id, value)}
                    >
                      <SelectTrigger {...common}>
                        <SelectValue
                          placeholder={t("chat.responseUi.chooseOption")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {field.options!.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : field.type === "checkbox" ? (
                    <Checkbox
                      {...common}
                      checked={displayValues[field.id] === true}
                      onCheckedChange={(value) =>
                        update(field.id, value === true)
                      }
                    />
                  ) : field.type === "textarea" ? (
                    <Textarea
                      {...common}
                      maxLength={2000}
                      value={String(displayValues[field.id] ?? "")}
                      onChange={(event) => update(field.id, event.target.value)}
                    />
                  ) : (
                    <Input
                      {...common}
                      type={field.type}
                      min={field.min}
                      max={field.max}
                      step={field.type === "number" ? "any" : undefined}
                      maxLength={2000}
                      autoComplete="off"
                      value={String(displayValues[field.id] ?? "")}
                      onChange={(event) => update(field.id, event.target.value)}
                    />
                  )}
                  {invalid && (
                    <FieldError id={`${id}-error`}>
                      {t("chat.responseUi.invalidField")}
                    </FieldError>
                  )}
                </Field>
              );
            })}
            {sendError && (
              <FieldError>{t("chat.responseUi.formSendFailed")}</FieldError>
            )}
            <Button type="submit" disabled={disabled}>
              {t(
                submitted
                  ? "chat.responseUi.formSubmitted"
                  : sending
                    ? "chat.responseUi.formSending"
                    : "chat.responseUi.formSubmit",
              )}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}

export function PanelView({
  panel,
  table,
}: {
  panel: ResponsePanel;
  table: (
    block: Extract<ResponsePanel["blocks"][number], { kind: "table" }>,
  ) => React.ReactNode;
}) {
  return (
    <Card data-response-ui="panel" size="sm">
      <CardHeader>
        <CardTitle>{panel.title}</CardTitle>
        {panel.description && (
          <CardDescription>{panel.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div
          className={
            panel.layout === "grid"
              ? "grid grid-cols-1 gap-4 @lg/thread:grid-cols-2"
              : "flex flex-col gap-4"
          }
        >
          {panel.blocks.map((block, index) => (
            <div
              key={block.kind === "form" ? block.id : index}
              className="min-w-0"
            >
              {block.kind === "form" ? (
                <PanelForm form={block} />
              ) : block.kind === "table" ? (
                table(block)
              ) : block.kind === "metric" ? (
                <dl>
                  <dt className="text-sm text-muted-foreground">
                    {block.label}
                  </dt>
                  <dd className="text-xl font-semibold break-words">
                    {block.value}
                  </dd>
                </dl>
              ) : block.kind === "heading" ? (
                <h3 className="font-semibold break-words">{block.text}</h3>
              ) : (
                <p className="whitespace-pre-wrap break-words">{block.text}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
