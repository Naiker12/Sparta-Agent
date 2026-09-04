import { authFetch } from "@/features/auth";
import {
  disposableTimeoutSignal,
} from "@/features/hub/lib/abort-signals";
import { formatApiErrorBody } from "@/lib/format-fastapi-error";
import { assertCompletedPaddedBody } from "../padded-response";

export const CHAT_HISTORY_UPDATED_EVENT = "sparta-chat-history-updated";
export const CHAT_PROJECTS_UPDATED_EVENT = "sparta-chat-projects-updated";

const THREAD_WRITE_TIMEOUT_MS = 30_000;

export async function threadWriteFetch(
  input: string,
  init: RequestInit,
  caller?: AbortSignal,
): Promise<Response> {
  const timeout = disposableTimeoutSignal(THREAD_WRITE_TIMEOUT_MS);
  if (caller === undefined) {
    try {
      return await authFetch(input, { ...init, signal: timeout.signal });
    } finally {
      timeout.dispose();
    }
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (caller.aborted) abort();
  caller.addEventListener("abort", abort);
  timeout.signal.addEventListener("abort", abort);
  try {
    return await authFetch(input, { ...init, signal: controller.signal });
  } finally {
    caller.removeEventListener("abort", abort);
    timeout.dispose();
  }
}

export class StreamInterruptedError extends Error {
  constructor() {
    super(
      "La respuesta fue interrumpida: la conexión se cerró antes de completar la generación. Reintenta.",
    );
    this.name = "StreamInterruptedError";
  }
}

export class GenerationLengthError extends Error {
  constructor() {
    super(
      "El modelo alcanzó el límite máximo de tokens antes de producir una respuesta final. Aumenta Max Tokens o desactiva thinking.",
    );
    this.name = "GenerationLengthError";
  }
}

export function notifyChatHistoryUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHAT_HISTORY_UPDATED_EVENT));
  }
}

export function notifyChatProjectsUpdated(): void {
  notifyChatHistoryUpdated();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHAT_PROJECTS_UPDATED_EVENT));
  }
}

export function parseErrorText(status: number, body: unknown): string {
  return formatApiErrorBody(body) ?? `Request failed (${status})`;
}

export function deferredError(
  body: unknown,
): { status: number; message: string } | null {
  const deferred =
    body && typeof body === "object"
      ? (
          body as {
            _deferred_error?: { status_code?: unknown; detail?: unknown };
          }
        )._deferred_error
      : undefined;
  if (!deferred || typeof deferred !== "object") return null;
  const status =
    typeof deferred.status_code === "number" ? deferred.status_code : 500;
  return {
    status,
    message: parseErrorText(status, { detail: deferred.detail }),
  };
}

export async function parseJsonOrThrow<T>(
  response: Response,
  paddedLabel?: string,
): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(parseErrorText(response.status, body));
  }
  const deferred = deferredError(body);
  if (deferred) {
    throw new Error(deferred.message);
  }
  if (paddedLabel !== undefined) {
    assertCompletedPaddedBody(body, paddedLabel);
  }
  return body as T;
}
