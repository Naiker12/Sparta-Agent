import {
  TelegramIcon,
  DiscordIcon,
  WhatsappIcon,
  SlackIcon,
} from "@hugeicons/core-free-icons";

export type ChannelPlatform = "telegram" | "discord" | "whatsapp" | "slack";
export const platforms = [
  { id: "telegram", name: "Telegram", icon: TelegramIcon, available: true },
  { id: "discord", name: "Discord", icon: DiscordIcon, available: false },
  { id: "whatsapp", name: "WhatsApp", icon: WhatsappIcon, available: false },
  { id: "slack", name: "Slack", icon: SlackIcon, available: false },
] as const;
