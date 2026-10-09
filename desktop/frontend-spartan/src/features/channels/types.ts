export type ChannelStatus =
  | "paused"
  | "connecting"
  | "connected"
  | "credentials_error"
  | "consumer_conflict"
  | "rate_limited"
  | "transport_error";
export type ChannelAccount = {
  owner_user_id?: string | null;
  project_access?: Record<string, "all" | "selected">;
  project_context?: Record<string, boolean>;
  voice_enabled?: boolean;
  profile_user_id?: string | null;
  usage?: ChannelUsage;
  id: string;
  name: string;
  platform: "telegram";
  bot_username: string;
  provider_id: string;
  provider_name: string;
  model: string;
  locale: "es" | "en";
  allowed_user_ids: string[];
  enabled: boolean;
  status: ChannelStatus;
};
export type ChannelUsage = {
  period_hours: number;
  requests: number;
  reported_requests: number;
  complete_requests: number;
  input_reports: number;
  output_reports: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  hourly_request_limit: number;
  hourly_requests_remaining: number;
};
export type ChannelInventory = {
  capabilities?: { id: string; status: "available" | "pending" }[];
  providers: { id: string; name: string; models: string[] }[];
  skills: { name: string }[];
  mcp: { name: string; enabled: boolean }[];
};
export type ChannelOverview = {
  voice?: ChannelVoiceStatus;
  accounts: ChannelAccount[];
  inventory: ChannelInventory;
  events: {
    id: number;
    account_id: string;
    code: string;
    created_at: number;
  }[];
};
export type ChannelVoiceStatus = {
  provider?: string;
  provider_name?: string;
  installing?: boolean;
  setup_failed?: boolean;
  downloading?: boolean;
  download_failed?: boolean;
  bytes_done?: number | null;
  bytes_total?: number | null;
  ready: boolean;
  model: string;
  engine: "gguf" | "transformers" | "remote" | null;
  reason:
    | "needs_model"
    | "needs_runtime"
    | "unavailable"
    | "needs_configuration"
    | null;
};
export type ChannelDraft = Pick<
  ChannelAccount,
  "name" | "provider_id" | "model" | "locale" | "allowed_user_ids"
> & { token: string };

export type PairingSession = {
  id: string;
  status: "waiting" | "review" | "approved" | "expired" | "cancelled";
  expires_at: number;
  user_id: string | null;
  username: string | null;
  name: string | null;
  confirmation: string | null;
  transport_status?: ChannelStatus;
};
export type PairingLink = PairingSession & { url: string };
