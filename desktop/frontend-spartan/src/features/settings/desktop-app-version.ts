import { SPARTA_VERSION } from "@/config/version";
import { isTauri } from "@/lib/api-base";

type VersionReader = () => Promise<string>;

async function readTauriAppVersion(): Promise<string> {
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

export async function loadDesktopAppVersion(
  readVersion: VersionReader = readTauriAppVersion,
): Promise<string | null> {
  if (typeof window !== "undefined" && window.electronAPI && typeof (window.electronAPI as any).getVersion === "function") {
    try {
      const v = await (window.electronAPI as any).getVersion();
      if (v) return String(v).trim();
    } catch {}
  }
  if (isTauri) {
    try {
      const version = await readVersion();
      return version.trim() || SPARTA_VERSION;
    } catch (error) {
      console.warn("Desktop app version read failed; using SPARTA_VERSION", error);
      return SPARTA_VERSION;
    }
  }
  return SPARTA_VERSION;
}
