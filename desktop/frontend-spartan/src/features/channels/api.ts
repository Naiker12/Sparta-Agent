import { authFetch } from "@/features/auth";
import type { ChannelDraft, ChannelOverview } from "./types";

export class ChannelApiError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

async function request<T>(path = "", init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/channels${path}`, init, {
    retryNetworkErrors: !init?.method || init.method === "GET",
  });
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
    request("", { method: "POST", ...json(draft) }),
  setEnabled: (id: string, enabled: boolean) =>
    request(`/${encodeURIComponent(id)}`, {
      method: "PATCH",
      ...json({ enabled }),
    }),
  remove: (id: string) =>
    request(`/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
