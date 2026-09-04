/**
 * Sparta Agent – Sidebar Constants and Types
 *
 * Centralización de tipos, constantes de ordenamiento, límites,
 * atajos de teclado y opciones de exportación para la barra lateral.
 */

import type { ReactNode } from "react";
import type { TranslationKey, useT } from "@/i18n";
import type {
  SidebarChatSort,
  SidebarOrganizeBy,
} from "@/features/chat";
import {
  CONVERSATION_MARKDOWN_FORMAT,
  CONVERSATION_MARKDOWN_LABEL,
} from "@/features/chat";
import {
  CloudIcon,
  CpuIcon,
  Message01Icon,
  PaintBrush02Icon,
  UserIcon,
  type ZapIcon,
} from "@hugeicons/core-free-icons";

export const EMPHASIS_MARKER = "__UNSLOTH_I18N_EMPHASIS_MARKER__";

export type AppT = ReturnType<typeof useT>;

export function renderEmphasizedTranslation(
  t: AppT,
  key: TranslationKey,
  emphasizedValue: string,
): ReactNode {
  const translated = t(key, { name: EMPHASIS_MARKER });
  const parts = translated.split(EMPHASIS_MARKER);
  if (parts.length === 1) return translated;

  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    if (part.length > 0) nodes.push(part);
    if (index < parts.length - 1) {
      nodes.push(<em key={`emphasis-${index}`}>{emphasizedValue}</em>);
    }
  });
  return nodes;
}

export function getTourId(pathname: string): string | null {
  if (pathname.startsWith("/studio")) return "studio";
  if (pathname.startsWith("/export")) return "export";
  if (pathname.startsWith("/chat")) return "chat";
  return null;
}

/** Optional user-menu shortcuts that jump to a settings tab; the id is the tab id. */
export const SETTINGS_TAB_MENU_ITEMS: Record<
  "profile" | "appearance" | "resources" | "chat" | "connections",
  { icon: typeof ZapIcon; labelKey: TranslationKey }
> = {
  profile: { icon: UserIcon, labelKey: "settings.tabs.profile" },
  appearance: { icon: PaintBrush02Icon, labelKey: "settings.tabs.appearance" },
  resources: { icon: CpuIcon, labelKey: "settings.tabs.resources" },
  chat: { icon: Message01Icon, labelKey: "settings.tabs.chat" },
  connections: { icon: CloudIcon, labelKey: "settings.tabs.connections" },
};

/** One navigable row, rendered as a NavItem or a MoreMenuItem depending on its pin state. */
export type NavRowDef = {
  icon: typeof ZapIcon;
  label: string;
  active: boolean;
  disabled?: boolean;
  tooltip?: string;
  spinner?: boolean;
  pending?: boolean;
  pendingTooltip?: string;
  badge?: string;
  onClick: () => void;
  onIntent?: () => void;
  className?: string;
  children?: ReactNode;
};

export type ConversationExportFormat =
  | "raw-jsonl"
  | "csv"
  | "sharegpt-jsonl"
  | typeof CONVERSATION_MARKDOWN_FORMAT;

/** An expanded project shows this many recent chats before "Show more". */
export const PROJECT_CHAT_LIMIT = 4;
/** And the Projects section shows this many folders before its own "Show more". */
export const SIDEBAR_PROJECT_LIMIT = 5;

/** The shared radio item ticks on the right; these read as settings, so tick first. */
export const menuRadioItemClass =
  "pl-9 pr-3 [&>[data-slot=dropdown-menu-radio-item-indicator]]:right-auto [&>[data-slot=dropdown-menu-radio-item-indicator]]:left-3";

export const SELECT_WITH_META =
  typeof navigator !== "undefined" &&
  /mac/i.test(navigator.platform || navigator.userAgent);

/** Insertion cue on the edge the row will land on, inset to the pill. */
export const DROP_CUE_BASE =
  "before:absolute before:inset-x-2 before:h-0.5 before:rounded-full before:bg-primary/70 before:content-['']";
export const DROP_CUE_TOP = `${DROP_CUE_BASE} before:-top-px`;
export const DROP_CUE_BOTTOM = `${DROP_CUE_BASE} before:-bottom-px`;

/** Every list offers the same three orders. */
export const CHAT_SORT_OPTIONS: Array<{
  value: SidebarChatSort;
  key: TranslationKey;
}> = [
  { value: "priority", key: "shell.organize.priority" },
  { value: "updated", key: "shell.organize.lastUpdated" },
  { value: "manual", key: "shell.organize.manualOrder" },
];

export const ORGANIZE_OPTIONS: Array<{
  value: SidebarOrganizeBy;
  key: TranslationKey;
}> = [
  { value: "project", key: "shell.organize.byProject" },
  { value: "list", key: "shell.organize.inOneList" },
];

export const CHAT_EXPORT_OPTIONS: Array<{
  label: string;
  format: ConversationExportFormat;
}> = [
  { label: "Raw JSONL", format: "raw-jsonl" },
  { label: "CSV", format: "csv" },
  { label: "ShareGPT JSONL", format: "sharegpt-jsonl" },
  { label: CONVERSATION_MARKDOWN_LABEL, format: CONVERSATION_MARKDOWN_FORMAT },
];

export function formatRelativeShort(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const s = Math.max(0, Math.floor(diffMs / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function createNavigationNonce(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function preloadSilently(request: Promise<unknown>): void {
  void request.catch(() => undefined);
}

export const VERDICT_UNKNOWN_POLL_MS = 3000;
export const SELF_HEAL_POLL_MS = 15000;
export const VERDICT_POLL_STALL_MS = 30000;
