import { authFetch } from "@/features/auth";
import type {
  ChannelAccount,
  ChannelDraft,
  ChannelOverview,
  ChannelVoiceStatus,
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
    init?.method === "POST" && (!path || path.endsWith("/voice/prepare"))
      ? 90000
      : 15000,
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
  revokeUser: (id: string, user: string) =>
    request(`/${encodeURIComponent(id)}/users/${encodeURIComponent(user)}`, {
      method: "DELETE",
    }),
  bindProfile: (id: string, userId: string | null) =>
    request(`/${encodeURIComponent(id)}/profile-binding`, {
      method: "PUT",
      ...json({ user_id: userId }),
    }),
  projects: (id: string) =>
    request<{
      projects: { id: string; name: string }[];
      grants: Record<string, string[]>;
      access?: Record<string, "all" | "selected">;
      context?: Record<string, boolean>;
    }>(`/${encodeURIComponent(id)}/projects`),
  grantProjects: (
    id: string,
    userId: string,
    projectIds: string[],
    mode: "all" | "selected" = "selected",
    context?: boolean,
  ) =>
    request(`/${encodeURIComponent(id)}/projects`, {
      method: "PUT",
      ...json({ user_id: userId, project_ids: projectIds, mode, context }),
    }),
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
  approvePairing: (
    id: string,
    session: string,
    purpose: "self" | "guest" = "guest",
  ) =>
    request<PairingSession>(
      `/${encodeURIComponent(id)}/pairings/${encodeURIComponent(session)}/approve`,
      { method: "POST", ...json({ purpose }) },
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
  setVoiceEnabled: (id: string, enabled: boolean) =>
    request(`/${encodeURIComponent(id)}/voice`, {
      method: "PATCH",
      ...json({ enabled }),
    }),
  prepareVoice: (id: string) =>
    request<ChannelVoiceStatus>(`/${encodeURIComponent(id)}/voice/prepare`, {
      method: "POST",
    }),
  remove: (id: string) =>
    request(`/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
