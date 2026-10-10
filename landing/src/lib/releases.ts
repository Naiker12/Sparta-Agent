import packageJson from '../../../package.json';

export const repository = "https://github.com/Naiker12/Sparta-Agent";
const version = packageJson.version;
const tag = `v${version}`;
export const release = {
  version,
  url: `${repository}/releases/tag/${tag}`,
};
export const platforms = [
  {
    id: "windows",
    name: "Windows",
    extension: ".exe",
    label: "Instalador · 64 bits",
    color: "#61c985",
    url: `${repository}/releases/download/${tag}/Sparta-Agent-Windows-${version}-Setup.exe`,
  },
  {
    id: "mac",
    name: "macOS · Apple silicon",
    extension: ".dmg",
    label: "Instalador · M1 y posteriores",
    color: "#d6adf2",
    url: `${repository}/releases/download/${tag}/Sparta-Agent-Mac-${version}-arm64-Installer.dmg`,
  },
  {
    id: "mac-intel",
    name: "macOS · Intel",
    extension: ".dmg",
    label: "Instalador · Intel de 64 bits",
    color: "#d6adf2",
    url: `${repository}/releases/download/${tag}/Sparta-Agent-Mac-${version}-x64-Installer.dmg`,
  },
  {
    id: "linux",
    name: "Linux",
    extension: ".AppImage",
    label: "AppImage · 64 bits",
    color: "#e3b866",
    url: `${repository}/releases/download/${tag}/Sparta-Agent-Linux-${version}.AppImage`,
  },
] as const;

export function detectPlatform() {
  const platform = navigator.userAgent;
  if (/Android|iPhone|iPad/i.test(platform)) return null;
  if (/Windows/i.test(platform)) return platforms[0];
  // macOS user agents do not reliably distinguish Intel from Apple silicon.
  if (/Macintosh|Mac OS X/i.test(platform)) return null;
  if (/Linux/i.test(platform)) return platforms.find(item => item.id === "linux")!;
  return null;
}
