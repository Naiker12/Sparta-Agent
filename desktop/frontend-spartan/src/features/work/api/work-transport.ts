import { translate as uiTranslate } from "@/i18n";
import { AUTH_SESSION_CLEARED_EVENT, authFetch, getAuthSessionEpoch } from "@/features/auth";

/** Shared work transport; a session change aborts retries with another user's token. */
export async function requestWorkJson<T>(
  url: string, init?: RequestInit, epoch = getAuthSessionEpoch(),
): Promise<T> {
  if (getAuthSessionEpoch() !== epoch) throw new Error(uiTranslate("ui.the_session_changed"));
  const controller = new AbortController();
  const abort = () => controller.abort();
  window.addEventListener(AUTH_SESSION_CLEARED_EVENT, abort);
  if (init?.signal?.aborted) abort();
  else init?.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await authFetch(url, { ...init, signal: controller.signal }, { retryNetworkErrors: false });
    if (getAuthSessionEpoch() !== epoch) throw new Error(uiTranslate("ui.the_session_changed"));
    if (!response.ok) {
      throw new Error(response.status === 422
        ? uiTranslate("ui.incompatible_work_configuration")
        : response.status === 409
          ? uiTranslate("ui.work_changed_in_another_session")
          : uiTranslate("ui.could_not_read_or_save_work"));
    }
    const result = await response.json() as T;
    if (getAuthSessionEpoch() !== epoch) throw new Error(uiTranslate("ui.the_session_changed"));
    return result;
  } finally {
    window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, abort);
    init?.signal?.removeEventListener("abort", abort);
  }
}
