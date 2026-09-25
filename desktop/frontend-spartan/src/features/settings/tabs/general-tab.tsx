import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PermissionModeDropdown, useChatRuntimeStore } from "@/features/chat";
// From the keys module, not the barrel or the store: both are in an import cycle with this file,
// so the key was still in its temporal dead zone when the module-scope list below read it, killing
// the module graph. The keys module imports nothing, so it is always evaluated first.
import { SIDEBAR_ORGANIZATION_STORAGE_KEY } from "@/features/chat/stores/sidebar-organization-keys";

import { CHAT_PROJECT_ATTACHMENT_TARGET_KEY } from "@/features/chat/utils/project-attachment-target";
import { LOCALE_STORAGE_KEY, useT } from "@/i18n";
import { isTauri } from "@/lib/api-base";
import { useEffect, useState } from "react";
import { loadCloseToTray, updateCloseToTray } from "../api/close-to-tray";
import { loadLaunchAtLogin, updateLaunchAtLogin } from "../api/launch-at-login";
import { LanguageControls } from "../components/language-segmented";
import { SettingsRow } from "../components/settings-row";
import { SettingsSection } from "../components/settings-section";
import { StudioVersionSection } from "../components/studio-version-section";
import { useDesktopBooleanSetting } from "../hooks/use-desktop-boolean-setting";
import { KEYBOARD_SHORTCUTS_STORAGE_KEY } from "../stores/keyboard-shortcuts-store";
import { SETTINGS_PANEL_PREFS_STORAGE_KEY } from "../stores/settings-panel-prefs-store";

// Keys cleared by "Reset all local preferences". NEVER include auth/session keys here -- that
// would log the user out (unsloth_auth_token, unsloth_auth_refresh_token, and
// unsloth_auth_must_change_password are excluded).
const PREFS_KEYS: string[] = [
  // Appearance
  "theme",
  "palette",
  "unsloth_appearance_customization",
  LOCALE_STORAGE_KEY,
  // UI state
  "sidebar_pinned",
  "sidebar_width",
  "chat_settings_width",
  "unsloth_sidebar_navigate_open",
  // Grouping, sort and the manual row order.
  SIDEBAR_ORGANIZATION_STORAGE_KEY,
  "unsloth_settings_active_tab",
  SETTINGS_PANEL_PREFS_STORAGE_KEY,
  // Rebound chords. Without this a reset leaves the user on shortcuts they
  // asked to throw away, and a chord bound to something unusable has no
  // escape hatch from this button.
  KEYBOARD_SHORTCUTS_STORAGE_KEY,
  // Chat runtime prefs
  CHAT_PROJECT_ATTACHMENT_TARGET_KEY,
  "unsloth_chat_auto_title",
  "unsloth_chat_permission_mode",
  // Legacy confirm key: loadPermissionMode falls back to it, so clear both or a reset restores it.
  "unsloth_chat_confirm_tool_calls",
  "unsloth_hf_token",
  "unsloth_auto_heal_tool_calls",
  "unsloth_nudge_tool_calls",
  "unsloth_max_tool_calls_per_message",
  "unsloth_tool_call_timeout",
  "unsloth_chat_inference_params",
  "unsloth_chat_collapsible_state",
  "unsloth_chat_preferences",
  "unsloth_model_configs",
  "unsloth_model_configs_migrated",
  "unsloth_load_settings",
  "unsloth_model_advanced_settings",
  "unsloth_chat_load_on_selection",
  // Model selector settings ("Select model settings" group)
  "unsloth_chat_expand_quantizations",
  "unsloth_chat_show_all_quantizations",
  "unsloth_models_fit_on_device_only",
  // Chat presets
  "unsloth_chat_custom_presets",
  "unsloth_chat_active_preset",
  "unsloth_chat_system_prompts",
  "unsloth_chat_system_prompts_migrated",
  // Profile personalization
  "sparta_user_profile",
  "unsloth_user_profile",
  // Guided tour flags
  "tour:studio:v1",
  // Update notifications
  "unsloth_show_llama_update_banner",
  "unsloth_monitor_overlay",
  // Voice settings
  "unsloth_voice_settings",
  // Retired keys. The onboarding wizard is gone, but installs that ran it still
  // carry its flag, so a reset has to clear it or the orphan outlives the app.
  "unsloth_onboarding_done",
];

// Set by resetAllPrefs so the unmount-commit effect skips writing back the in-memory draft.
let resetInProgress = false;

function resetAllPrefs() {
  resetInProgress = true;
  for (const key of PREFS_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  window.location.reload();
}

export function GeneralTab() {
  const t = useT();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const launchAtLoginSetting = useDesktopBooleanSetting({
    enabled: isTauri,
    load: loadLaunchAtLogin,
    save: updateLaunchAtLogin,
    loadError: t("settings.general.startup.loadError"),
    saveError: t("settings.general.startup.saveError"),
  });
  const closeToTraySetting = useDesktopBooleanSetting({
    enabled: isTauri,
    load: loadCloseToTray,
    save: updateCloseToTray,
    loadError: t("settings.general.startup.loadError"),
    saveError: t("settings.general.startup.closeToTraySaveError"),
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold font-heading">
          {t("settings.general.title")}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t("settings.general.description")}
        </p>
      </header>

      {/* Desktop-only, and self-gating: outside the desktop app both render
          nothing and the section keeps just the version rows. */}
      <StudioVersionSection />

      <SettingsSection title={t("settings.appearance.language.title")}>
        <SettingsRow
          label={t("settings.appearance.language.label")}
          description={t("settings.appearance.language.description")}
        >
          <LanguageControls />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t("settings.general.permissions.sectionTitle")}>
        <SettingsRow
          label={t("settings.general.permissions.bypassLabel")}
          description={t("settings.general.permissions.bypassDescription")}
        >
          <PermissionModeDropdown />
        </SettingsRow>
      </SettingsSection>

      {isTauri ? (
        <SettingsSection title={t("settings.general.startup.sectionTitle")}>
          <SettingsRow
            label={t("settings.general.startup.launchAtLogin")}
            description={t("settings.general.startup.launchAtLoginDescription")}
          >
            <div className="flex flex-col items-end gap-1">
              <Switch
                checked={launchAtLoginSetting.value ?? false}
                disabled={
                  launchAtLoginSetting.value === null ||
                  launchAtLoginSetting.saving
                }
                onCheckedChange={(enabled) =>
                  void launchAtLoginSetting.update(enabled)
                }
              />
              {launchAtLoginSetting.error ? (
                <span className="max-w-[260px] text-right text-xs text-destructive">
                  {launchAtLoginSetting.error}
                </span>
              ) : null}
            </div>
          </SettingsRow>

          {closeToTraySetting.supported ? (
            <SettingsRow
              label={t("settings.general.startup.closeToTray")}
              description={t("settings.general.startup.closeToTrayDescription")}
            >
              <div className="flex flex-col items-end gap-1">
                <Switch
                  checked={closeToTraySetting.value ?? false}
                  disabled={
                    closeToTraySetting.value === null ||
                    closeToTraySetting.saving
                  }
                  onCheckedChange={(enabled) =>
                    void closeToTraySetting.update(enabled)
                  }
                />
                {closeToTraySetting.error ? (
                  <span className="max-w-[260px] text-right text-xs text-destructive">
                    {closeToTraySetting.error}
                  </span>
                ) : null}
              </div>
            </SettingsRow>
          ) : null}
        </SettingsSection>
      ) : null}

      <SettingsSection
        title={t("settings.general.resetPreferences.sectionTitle")}
      >
        <SettingsRow
          destructive={true}
          label={t("settings.general.resetPreferences.label")}
          description={t("settings.general.resetPreferences.description")}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="text-destructive hover:text-destructive hover:border-destructive/60"
          >
            {t("settings.general.resetPreferences.action")}
          </Button>
        </SettingsRow>
      </SettingsSection>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("settings.general.resetPreferences.confirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("settings.general.resetPreferences.confirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={resetAllPrefs}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {t("settings.general.resetPreferences.confirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
