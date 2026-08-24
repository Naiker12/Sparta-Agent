
export type ProviderCredentialEdit =
  | { action: "replace"; apiKey: string }
  | { action: "clear" }
  | { action: "keep" }
  | { action: "missing" };

export function resolveProviderCredentialEdit(
  hasExistingCredential: boolean,
  apiKey: string,
  clearRequested: boolean,
): ProviderCredentialEdit {
  const replacement = apiKey.trim();
  if (replacement) return { action: "replace", apiKey: replacement };
  if (clearRequested) return { action: "clear" };
  return hasExistingCredential ? { action: "keep" } : { action: "missing" };
}
