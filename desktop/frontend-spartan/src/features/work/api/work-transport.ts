import { AUTH_SESSION_CLEARED_EVENT, authFetch, getAuthSessionEpoch } from "@/features/auth";

/** Shared work transport; a session change aborts retries with another user's token. */
export async function requestWorkJson<T>(
  url: string, init?: RequestInit, epoch = getAuthSessionEpoch(),
): Promise<T> {
  if (getAuthSessionEpoch() !== epoch) throw new Error("La sesión cambió");
  const controller = new AbortController();
  const abort = () => controller.abort();
  window.addEventListener(AUTH_SESSION_CLEARED_EVENT, abort);
  if (init?.signal?.aborted) abort();
  else init?.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await authFetch(url, { ...init, signal: controller.signal }, { retryNetworkErrors: false });
    if (getAuthSessionEpoch() !== epoch) throw new Error("La sesión cambió");
    if (!response.ok) {
      throw new Error(response.status === 422
        ? "El tamaño o la configuración no son compatibles. Revisa los mensajes antes de continuar."
        : response.status === 409
          ? "El trabajo cambió en otra sesión. Vuelve a consultarlo antes de continuar."
          : "No se pudo consultar o guardar el trabajo.");
    }
    const result = await response.json() as T;
    if (getAuthSessionEpoch() !== epoch) throw new Error("La sesión cambió");
    return result;
  } finally {
    window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, abort);
    init?.signal?.removeEventListener("abort", abort);
  }
}
