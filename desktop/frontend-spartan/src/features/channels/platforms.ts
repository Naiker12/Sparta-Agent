import { default as TelegramIcon } from "@hugeicons/core-free-icons/TelegramIcon";
import { default as DiscordIcon } from "@hugeicons/core-free-icons/DiscordIcon";
import { default as WhatsappIcon } from "@hugeicons/core-free-icons/WhatsappIcon";
import { default as SlackIcon } from "@hugeicons/core-free-icons/SlackIcon";

export type ChannelPlatform = "telegram" | "discord" | "whatsapp" | "slack";
export const platforms = [
  { id: "telegram", name: "Telegram", icon: TelegramIcon, available: true },
  { id: "discord", name: "Discord", icon: DiscordIcon, available: false },
  { id: "whatsapp", name: "WhatsApp", icon: WhatsappIcon, available: false },
  { id: "slack", name: "Slack", icon: SlackIcon, available: false },
] as const;
