import { authFetch } from "@/features/auth";
import type {
  ChannelAccount,
  ChannelDraft,
  ChannelOverview,
  PairingLink,
  PairingSession,
} from "./types";

export class ChannelApiError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

async function request<T>(path = "", init?: RequestInit): Promise<T> {
  const deadline = AbortSignal.timeout(
    !path && init?.method === "POST" ? 90000 : 15000,
  );
  const signal = init?.signal
    ? AbortSignal.any([init.signal, deadline])
    : deadline;
  const response = await authFetch(
    `/api/channels${path}`,
    { ...init, signal },
    {
      retryNetworkErrors: !init?.method || init.method === "GET",
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ChannelApiError(
      typeof payload.detail === "string" ? payload.detail : "request_failed",
    );
  }
  return response.json() as Promise<T>;
}
const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
export const channelsApi = {
  overview: (signal?: AbortSignal) => request<ChannelOverview>("", { signal }),
  create: (draft: ChannelDraft) =>
    request<ChannelAccount>("", { method: "POST", ...json(draft) }),
  startPairing: (id: string) =>
    request<PairingLink>(`/${encodeURIComponent(id)}/pairings`, {
      method: "POST",
    }),
  pairing: (id: string, session: string, signal?: AbortSignal) =>
    request<PairingSession>(
      `/${encodeURIComponent(id)}/pairings/${encodeURIComponent(session)}`,
      { signal },
    ),
  approvePairing: (id: string, session: string) =>
    request<PairingSession>(
      `/${encodeURIComponent(id)}/pairings/${encodeURIComponent(session)}/approve`,
      { method: "POST" },
    ),
  cancelPairing: (id: string, session: string) =>
    request(
      `/${encodeURIComponent(id)}/pairings/${encodeURIComponent(session)}`,
      { method: "DELETE" },
    ),
  setEnabled: (id: string, enabled: boolean) =>
    request(`/${encodeURIComponent(id)}`, {
      method: "PATCH",
      ...json({ enabled }),
    }),
  remove: (id: string) =>
    request(`/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
