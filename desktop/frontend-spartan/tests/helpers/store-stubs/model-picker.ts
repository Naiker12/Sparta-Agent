
// The picker barrel reaches the whole chat UI; the store only needs these three.

export function applyPerModelConfigToRuntime(): void {}

export function currentRuntimePerModelConfig(): Record<string, unknown> {
  return {};
}

export function perModelConfigsEqual(): boolean {
  return true;
}
