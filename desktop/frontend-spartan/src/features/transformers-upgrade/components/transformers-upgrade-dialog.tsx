import { useT as useUiT } from "@/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { PackageIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { upgradeDialogActions } from "../lib/upgrade-dialog-actions";
import { useTransformersUpgradeDialogStore } from "../stores/transformers-upgrade-dialog-store";

function modelDisplayName(modelName: string | null): string {
  if (!modelName) {
    return "This model";
  }
  return modelName.split("/").pop() || modelName;
}

/** Root-mounted consent dialog for models needing a newer transformers;
 *  Install runs the sidecar install and resumes the paused load on success. */
export function TransformersUpgradeDialog() {
  const uiT = useUiT();

  const open = useTransformersUpgradeDialogStore((s) => s.open);
  const modelName = useTransformersUpgradeDialogStore((s) => s.modelName);
  const upgrade = useTransformersUpgradeDialogStore((s) => s.upgrade);
  const phase = useTransformersUpgradeDialogStore((s) => s.phase);
  const errorMessage = useTransformersUpgradeDialogStore((s) => s.errorMessage);
  const trustRemoteCodeFallback = useTransformersUpgradeDialogStore(
    (s) => s.trustRemoteCodeFallback,
  );
  const install = useTransformersUpgradeDialogStore((s) => s.install);
  const resolve = useTransformersUpgradeDialogStore((s) => s.resolve);

  const displayName = modelDisplayName(modelName);
  const modelType = upgrade?.model_type ?? "unknown";
  const version = upgrade?.pypi_version ?? null;
  // Only released PyPI versions are installable; dev (main) builds are never offered.
  const { installable, devOnly, customCode } = upgradeDialogActions({
    upgrade,
    phase,
    trustRemoteCodeFallback,
  });
  const installing = phase === "installing";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Escape/overlay dismiss must not abandon an in-flight install.
        if (!(next || installing)) {
          resolve(false);
        }
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader className="min-w-0">
          <div className="flex w-full min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <HugeiconsIcon icon={PackageIcon} className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1">
                <AlertDialogTitle>{uiT("ui.new_model_architecture")}</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="font-medium text-foreground">
                    {displayName}
                  </span>{" "}
                  {uiT("ui.uses_the")}{" "}
                  <span className="font-mono text-foreground">{modelType}</span>{" "}
                  {uiT("ui.architecture_which_your_installed_transformers_does_not_support_y")}{" "}
                  {installable ? (
                    <>
                      {uiT("ui.install_transformers")}{" "}
                      <span className="font-medium text-foreground">
                        {version}
                      </span>{" "}
                      {uiT("ui.from_pypi_to_load_it_the_install_runs_once_and_can_take_a_minute_")}</>
                  ) : devOnly ? (
                    <>
                      {uiT("ui.legacy_even_the_latest_transformers_release_on_pypi_does_not_support_it_")}</>
                  ) : (
                    <>
                      {uiT("ui.no_released_transformers_version_supports_it_yet_so_it_cannot_be_")}</>
                  )}
                  {customCode ? (
                    <>
                      {" "}
                      {uiT("ui.this_model_also_ships_its_own_modeling_code_you_can_continue_and_")}</>
                  ) : null}
                </AlertDialogDescription>
              </div>

              {phase === "error" && errorMessage ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {errorMessage}
                </p>
              ) : null}

              {installing ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="size-3.5" />
                  {uiT("ui.installing_transformers")}{" "}{version}{uiT("ui.this_can_take_a_minute")}</p>
              ) : null}
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={installing}>{uiT("chat.workspace.cancel")}</AlertDialogCancel>
          {installable ? (
            <>
              {customCode ? (
                // The model ships custom code, so the caller's trust_remote_code gate
                // loads it on the installed transformers. Offered next to Install, not
                // only after one fails: installing activates the 16-bit sidecar, so this
                // is the only way a 4-bit run on this model can start.
                <AlertDialogAction
                  className="bg-transparent text-foreground hover:bg-accent"
                  onClick={() => resolve(true)}
                >
                  {uiT("ui.continue_with_custom_code")}</AlertDialogAction>
              ) : null}
              <AlertDialogAction
                disabled={installing}
                className={cn(installing && "pointer-events-none")}
                onClick={(event) => {
                  // Keep the dialog open; the store closes it on success.
                  event.preventDefault();
                  void install();
                }}
              >
                {installing ? (
                  <>
                    <Spinner className="size-4" />
                    {uiT("settings.resources.llamaBackend.applying")}</>
                ) : phase === "error" ? (
                  uiT("ui.retry_install")
                ) : (
                  `Install transformers ${version}`
                )}
              </AlertDialogAction>
            </>
          ) : customCode ? (
            // No installable release but the model ships custom code: continue
            // into the caller's trust_remote_code gate as the last resort.
            <AlertDialogAction onClick={() => resolve(true)}>
              {uiT("ui.continue_with_custom_code")}</AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
