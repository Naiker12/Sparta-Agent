


/// The install is fine, the folder it must run from is not reachable.
/// Mirrors WORKING_DIRECTORY_UNAVAILABLE in studio/src-tauri/src/preflight/managed.rs.
export const WORKING_DIRECTORY_UNAVAILABLE = "working_directory_unavailable";

/// The folder is reachable; a path setting the user wrote is not resolvable.
/// Mirrors PATH_SETTING_UNRESOLVABLE in studio/src-tauri/src/preflight/managed.rs.
export const PATH_SETTING_UNRESOLVABLE = "path_setting_unresolvable";

export function preflightStaleMessage(
  disposition: string,
  reason: string | null,
): string {
  const spanish = getLocale() === "es";
  // The backend appends the setting it could not preserve, as `reason:NAME`, so
  // the discriminator is the part before the colon and the name is the rest.
  const [kind, setting] = (reason ?? "").split(":", 2);
  // Not an install problem: the home folder itself is unreachable, and updating
  // needs the same folder. The roaming-profile cause is a Windows one, but this
  // reason reaches every platform (`home_dir_available()` is probed ungated), so
  // it is offered rather than asserted.
  if (kind === WORKING_DIRECTORY_UNAVAILABLE) {
    const cause =
      typeof navigator !== "undefined" && /Win/i.test(navigator.platform ?? "")
        ? " This usually means a network or roaming profile is not available yet."
        : "";
    if (spanish) {
      const spanishCause = cause
        ? " Normalmente significa que un perfil de red o itinerante aún no está disponible."
        : "";
      return `Spartan no puede acceder a tu carpeta de usuario, por lo que no tiene dónde ejecutarse.${spanishCause} Vuelve a conectarte e inténtalo otra vez.`;
    }
    return `Spartan cannot reach your user folder, so it has nowhere to run from.${cause} Reconnect and try again.`;
  }
  // Also not an install problem, and not the folder either: one of Spartan's own
  // path settings names somewhere unresolvable, so the value is the fix.
  if (kind === PATH_SETTING_UNRESOLVABLE) {
    const which = setting ? `${setting} points` : "One of Spartan's folder settings points";
    if (spanish) {
      const spanishWhich = setting
        ? `${setting} apunta`
        : "Una de las configuraciones de carpeta de Spartan apunta";
      return `${spanishWhich} a una ubicación que no se puede resolver, por lo que Spartan no tiene un lugar seguro desde donde ejecutarse. Configúrala con una ruta completa, por ejemplo D:\\spartan-cache, e inténtalo otra vez.`;
    }
    return `${which} somewhere that cannot be resolved, so Spartan has nowhere safe to run from. Set it to a full path, such as D:\\spartan-cache, and try again.`;
  }
  if (disposition === "owned_stale") {
    return spanish
      ? "El backend de Spartan administrado por el escritorio es demasiado antiguo para esta aplicación. Ejecuta `spartan studio update` y reinicia Spartan."
      : "Desktop-owned Spartan backend is too old for this desktop app. Run `spartan studio update`, then restart Spartan.";
  }
  return spanish
    ? "La instalación administrada de Spartan es demasiado antigua. Ejecuta `spartan studio update`."
    : "Managed Spartan install is too old. Run `spartan studio update`.";
}
import { getLocale } from "@/i18n";
