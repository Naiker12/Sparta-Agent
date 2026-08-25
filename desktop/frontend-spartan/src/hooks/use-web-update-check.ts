import { SPARTA_VERSION } from "@/config/version";
import { useCallback, useEffect, useState } from "react";

const UPDATE_CHECK_DELAY_MS = 3000;
const DISMISS_PREFIX = "sparta_update_dismissed";

export interface SpartaUpdateStatus {
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseUrl: string;
  releaseNotes?: string;
  publishedAt?: string;
}

export type WebUpdateStatus = SpartaUpdateStatus;

function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^v/, "").trim();
  const parts = clean.split(".").map((p) => parseInt(p, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function isNewerVersion(latest: string, current: string): boolean {
  const [lMajor, lMinor, lPatch] = parseSemver(latest);
  const [cMajor, cMinor, cPatch] = parseSemver(current);
  if (lMajor > cMajor) return true;
  if (lMajor < cMajor) return false;
  if (lMinor > cMinor) return true;
  if (lMinor < cMinor) return false;
  return lPatch > cPatch;
}

function getPlatformAsset(assets: Array<{ name: string; browser_download_url: string }>): string | null {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
  const isWin = userAgent.includes("win");
  const isMac = userAgent.includes("mac");

  if (isWin) {
    const winAsset = assets.find((a) => a.name.endsWith(".exe"));
    if (winAsset) return winAsset.browser_download_url;
  } else if (isMac) {
    const macAsset = assets.find((a) => a.name.endsWith(".dmg"));
    if (macAsset) return macAsset.browser_download_url;
  } else {
    const linuxAsset = assets.find((a) => a.name.endsWith(".AppImage"));
    if (linuxAsset) return linuxAsset.browser_download_url;
  }

  return assets[0]?.browser_download_url || null;
}

function dismissalKey(version: string): string {
  return `${DISMISS_PREFIX}:${version}`;
}

function isDismissed(version: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(dismissalKey(version)) !== null;
  } catch {
    return false;
  }
}

function markDismissed(version: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dismissalKey(version), String(Date.now()));
  } catch {}
}

async function fetchLatestGitHubRelease(): Promise<SpartaUpdateStatus | null> {
  try {
    const res = await fetch("https://api.github.com/repos/Naiker12/Sparta-Agent/releases/latest", {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tagName = data.tag_name || "";
    const cleanTag = tagName.replace(/^v/, "");

    if (!cleanTag || !isNewerVersion(cleanTag, SPARTA_VERSION)) {
      return null;
    }

    const downloadUrl =
      (Array.isArray(data.assets) ? getPlatformAsset(data.assets) : null) ||
      data.html_url ||
      `https://github.com/Naiker12/Sparta-Agent/releases/tag/${tagName}`;

    return {
      currentVersion: SPARTA_VERSION,
      latestVersion: cleanTag,
      downloadUrl,
      releaseUrl: data.html_url || `https://github.com/Naiker12/Sparta-Agent/releases/tag/${tagName}`,
      releaseNotes: data.body || "",
      publishedAt: data.published_at,
    };
  } catch {
    return null;
  }
}

export function useWebUpdateCheck({ enabled = true }: { enabled?: boolean } = {}) {
  const [status, setStatus] = useState<SpartaUpdateStatus | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      return;
    }

    let canceled = false;
    const timer = window.setTimeout(() => {
      fetchLatestGitHubRelease()
        .then((update) => {
          if (!canceled && update && !isDismissed(update.latestVersion)) {
            setStatus(update);
          }
        })
        .catch(() => {});
    }, UPDATE_CHECK_DELAY_MS);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [enabled]);

  const dismiss = useCallback(() => {
    setStatus((current) => {
      if (current) {
        markDismissed(current.latestVersion);
      }
      return null;
    });
  }, []);

  const snooze = useCallback(() => {
    setStatus(null);
  }, []);

  return { status, dismiss, snooze };
}
