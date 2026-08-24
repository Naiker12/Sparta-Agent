import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";
import { useEffect, useState } from "react";
import {
  loadOpenAIAutoSwitchSettings,
  updateOpenAIAutoSwitchSettings,
} from "../api/openai-auto-switch";
import { SettingsRow } from "./settings-row";
import { SettingsSection } from "./settings-section";

const MIN_IDLE_SECONDS = 60;

/**
 * The API page intentionally exposes only the safe memory-recovery control.
 * Model switching, remote access and automatic downloads are not part of the
 * simplified Spartan interface.
 */
export function ModelIdleUnloadSection() {
  const t = useT();
  const [seconds, setSeconds] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadOpenAIAutoSwitchSettings()
      .then((settings) => {
        if (!cancelled) setSeconds(String(settings.autoUnloadIdleSeconds));
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : t("settings.general.modelAutoSwitch.loadError"),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const save = () => {
    const value = Number(seconds);
    if (!Number.isInteger(value) || (value !== 0 && value < MIN_IDLE_SECONDS)) {
      setError(t("settings.general.modelAutoSwitch.idleError"));
      return;
    }
    setSaving(true);
    setError(null);
    void updateOpenAIAutoSwitchSettings({
      // The backend uses this flag to enable its idle reclaimer. No other
      // auto-switch or auto-download control is rendered in Spartan.
      enabled: true,
      autoUnloadIdleSeconds: value,
    })
      .then((saved) => setSeconds(String(saved.autoUnloadIdleSeconds)))
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : t("settings.general.modelAutoSwitch.saveError"),
        );
      })
      .finally(() => setSaving(false));
  };

  return (
    <SettingsSection title={t("settings.general.modelAutoSwitch.idleUnload")}>
      <SettingsRow
        label={t("settings.general.modelAutoSwitch.idleUnload")}
        description={t("settings.general.modelAutoSwitch.idleUnloadDescription")}
      >
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={1}
              value={seconds}
              disabled={saving}
              aria-label={t("settings.general.modelAutoSwitch.idleSecondsAriaLabel")}
              onChange={(event) => setSeconds(event.target.value)}
              className="h-8 w-24"
            />
            <span className="text-xs font-medium text-muted-foreground">s</span>
            <Button variant="outline" size="sm" disabled={saving} onClick={save}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
          {error ? (
            <span className="max-w-[260px] text-right text-xs text-destructive">
              {error}
            </span>
          ) : null}
        </div>
      </SettingsRow>
    </SettingsSection>
  );
}
