import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useLocale, useT } from "@/i18n";
import { Spinner } from "@/components/ui/spinner";
import { TELEGRAM_BOTFATHER_URL } from "../links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ChannelApiError, channelsApi } from "../api";
import type { ChannelDraft, ChannelInventory } from "../types";

export function ConnectTelegram({
  open,
  onOpenChange,
  inventory,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: ChannelInventory;
  onSaved: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [draft, setDraft] = useState<ChannelDraft>({
    name: "Telegram",
    token: "",
    provider_id: "",
    model: "",
    locale: locale === "es" ? "es" : "en",
    allowed_user_ids: [],
  });
  const [step, setStep] = useState(0);
  const [users, setUsers] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const provider = inventory.providers.find((p) => p.id === draft.provider_id);
  const resetSecret = () => {
    setDraft((current) => ({ ...current, token: "" }));
    setError("");
    setStep(0);
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    const ids = users.split(/[\s,]+/).filter(Boolean);
    if (
      !ids.length ||
      ids.length > 20 ||
      ids.some(
        (id) => !/^\d+$/.test(id) || Number(id) <= 0 || Number(id) >= 2 ** 53,
      )
    ) {
      setError(t("channels.invalidIds"));
      return;
    }
    setBusy(true);
    try {
      await channelsApi.create({
        ...draft,
        name: draft.name.trim(),
        allowed_user_ids: ids,
      });
      resetSecret();
      onSaved();
      onOpenChange(false);
    } catch (cause) {
      const code =
        cause instanceof ChannelApiError ? cause.code : "request_failed";
      setError(
        code === "webhook_conflict"
          ? t("channels.webhookConflict")
          : code === "bot_already_configured"
            ? t("channels.duplicateBot")
            : code === "invalid_provider"
              ? t("channels.invalidProvider")
              : t("channels.saveFailed"),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          if (!value) resetSecret();
          onOpenChange(value);
        }
      }}
    >
      <DialogContent className="sm:max-w-xl" showCloseButton={false}>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-5 right-5"
            disabled={busy}
            aria-label={t("channels.cancel")}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle>{t("channels.connectTelegram")}</DialogTitle>
          <DialogDescription>
            {t("channels.wizardDescription")}
          </DialogDescription>
        </DialogHeader>
        <ol
          aria-label={t("channels.setupSteps")}
          className="grid grid-cols-3 gap-3"
        >
          {(["bot", "model", "access"] as const).map((name, index) => (
            <li
              key={name}
              aria-current={step === index ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 text-xs",
                step === index
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  step === index
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                {index + 1}
              </span>
              {t(`channels.wizard.${name}`)}
            </li>
          ))}
        </ol>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <FieldGroup>
            {step === 0 && (
              <>
                <div className="bg-muted rounded-xl p-4">
                  <p className="text-sm font-medium">
                    {t("channels.createBotTitle")}
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {t("channels.createBotHelp")}
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <a
                      href={TELEGRAM_BOTFATHER_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("channels.openBotFather")}
                    </a>
                  </Button>
                </div>
                <Field>
                  <FieldLabel htmlFor="channel-name">
                    {t("channels.connectionName")}
                  </FieldLabel>
                  <Input
                    id="channel-name"
                    value={draft.name}
                    maxLength={80}
                    required
                    disabled={busy}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="channel-token">
                    {t("channels.botToken")}
                  </FieldLabel>
                  <Input
                    id="channel-token"
                    type="password"
                    autoComplete="new-password"
                    value={draft.token}
                    maxLength={200}
                    minLength={20}
                    required
                    disabled={busy}
                    onChange={(e) =>
                      setDraft({ ...draft, token: e.target.value.trim() })
                    }
                  />
                  <FieldDescription>
                    {t("channels.tokenPrivate")}
                  </FieldDescription>
                </Field>
              </>
            )}
            {step === 1 && (
              <>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t("channels.chooseAssistantHelp")}
                </p>
                {!inventory.providers.length && (
                  <Alert>
                    <AlertDescription>
                      {t("channels.noProviders")}
                    </AlertDescription>
                  </Alert>
                )}
                <Field>
                  <FieldLabel htmlFor="channel-provider">
                    {t("channels.provider")}
                  </FieldLabel>
                  <Select
                    value={draft.provider_id}
                    disabled={busy}
                    onValueChange={(value) =>
                      setDraft({ ...draft, provider_id: value, model: "" })
                    }
                  >
                    <SelectTrigger id="channel-provider" className="w-full">
                      <SelectValue placeholder={t("channels.chooseProvider")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {inventory.providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="channel-model">
                    {t("channels.model")}
                  </FieldLabel>
                  <Select
                    value={draft.model}
                    disabled={!provider || busy}
                    onValueChange={(value) =>
                      setDraft({ ...draft, model: value })
                    }
                  >
                    <SelectTrigger id="channel-model" className="w-full">
                      <SelectValue placeholder={t("channels.chooseModel")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {provider?.models.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}
            {step === 2 && (
              <>
                <Field>
                  <FieldLabel htmlFor="channel-users">
                    {t("channels.authorizedUsers")}
                  </FieldLabel>
                  <Input
                    id="channel-users"
                    inputMode="numeric"
                    value={users}
                    required
                    disabled={busy}
                    placeholder="123456789"
                    onChange={(e) => setUsers(e.target.value)}
                  />
                  <FieldDescription>{t("channels.usersHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="channel-language">
                    {t("channels.botLanguage")}
                  </FieldLabel>
                  <Select
                    value={draft.locale}
                    disabled={busy}
                    onValueChange={(value) =>
                      setDraft({ ...draft, locale: value as "es" | "en" })
                    }
                  >
                    <SelectTrigger id="channel-language" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="bg-muted rounded-xl p-4 text-sm">
                  <p className="font-medium">{draft.name}</p>
                  <p className="text-muted-foreground mt-1 break-all">
                    {provider?.name} · {draft.model}
                  </p>
                  <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                    {t("channels.savePausedHelp")}
                  </p>
                  <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                    {t("channels.contextHelp")}
                  </p>
                </div>
              </>
            )}
          </FieldGroup>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (step) {
                  setStep(step - 1);
                  setError("");
                } else {
                  resetSecret();
                  onOpenChange(false);
                }
              }}
            >
              {t(step ? "channels.back" : "channels.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                busy || (step === 1 && (!draft.provider_id || !draft.model))
              }
            >
              {busy && <Spinner label={t("channels.saving")} />}
              {t(
                busy
                  ? "channels.saving"
                  : step === 2
                    ? "channels.verifySave"
                    : "channels.continue",
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
