// Full access belongs to this installation, never to a shared/exported thread.
export const DEVICE_FULL_ACCESS_KEY = "unsloth_chat_device_full_access";

export function restoreDevicePermissionMode<T extends string>(
  remembered: string | null,
  fallback: T,
): T | "full" {
  return remembered === "true" ? "full" : fallback;
}
