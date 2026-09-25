import { getAuthSessionEpoch, hasAuthToken } from "@/features/auth";
import { useExternalProvidersStore } from "@/features/chat/stores/external-providers-store";
import { syncExternalProvidersFromBackend } from "@/features/chat/sync-external-providers";

export function bootstrapPersistedCredentials(): Promise<void> {
  const sessionEpoch = getAuthSessionEpoch();
  const isCurrent = () =>
    hasAuthToken() && getAuthSessionEpoch() === sessionEpoch;
  // API-only builds persist only provider credentials. Hugging Face tokens
  // belonged to the retired local-model catalogue and must not be hydrated.
  return syncExternalProvidersFromBackend(
    useExternalProvidersStore.getState().providers,
    isCurrent,
  ).then((providers) => {
    if (isCurrent()) {
      useExternalProvidersStore.getState().setProviders(providers);
    }
  });
}
