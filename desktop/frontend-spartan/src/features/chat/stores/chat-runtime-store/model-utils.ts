/**
 * Sparta Agent - Utilidades de Identificación y Formato de Modelos
 */

export function hasGgufSource(x: {
  ggufVariant?: string;
  nativePathToken?: string;
  isGguf?: boolean;
}): boolean {
  return (
    x.ggufVariant != null || x.nativePathToken != null || x.isGguf === true
  );
}

export function isLocalModelPath(id: string): boolean {
  return /^(\/|\.{1,2}[\\/]|~[\\/]|[A-Za-z]:[\\/]|\\\\)/.test(id);
}

export function isDownloadableHubRepo(x: {
  id: string;
  source?: string;
  isLora?: boolean;
  ggufVariant?: string;
  nativePathToken?: string;
  isGguf?: boolean;
}): boolean {
  return (
    x.source === "hub" &&
    !hasGgufSource(x) &&
    x.isLora !== true &&
    x.nativePathToken == null &&
    !isLocalModelPath(x.id)
  );
}
