/** Stable, deliberately varied seeds shown in the profile avatar picker. */
export const BLOBATAR_AVATARS = Array.from(
  { length: 28 },
  (_, index) => `sparta-avatar-${String(index + 1).padStart(2, "0")}`,
);

export const BLOBATAR_PREFIX = "blobatar:";

export function blobatarAvatarValue(seed: string): string {
  return `${BLOBATAR_PREFIX}${seed}`;
}

export function blobatarSeedFromValue(value: string | null): string | null {
  return value?.startsWith(BLOBATAR_PREFIX)
    ? value.slice(BLOBATAR_PREFIX.length) || null
    : null;
}
