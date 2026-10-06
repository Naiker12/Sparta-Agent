export type ChannelStatus =
  | "paused"
  | "connecting"
  | "connected"
  | "credentials_error"
  | "consumer_conflict"
  | "rate_limited"
  | "transport_error";
export type ChannelAccount = {
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
export type ChannelInventory = {
  providers: { id: string; name: string; models: string[] }[];
  skills: { name: string }[];
  mcp: { name: string; enabled: boolean }[];
};
export type ChannelOverview = {
  accounts: ChannelAccount[];
  inventory: ChannelInventory;
  events: {
    id: number;
    account_id: string;
    code: string;
    created_at: number;
  }[];
};
export type ChannelDraft = Pick<
  ChannelAccount,
  "name" | "provider_id" | "model" | "locale" | "allowed_user_ids"
> & { token: string };
