import type { TourStep } from "@/features/tour";
import type { useT } from "@/i18n";

/** Read-only orientation: never creates chats, sends messages or changes settings. */
export function buildChatTourSteps({ t }: { t: ReturnType<typeof useT> }): TourStep[] {
  const step = (id: string, target: string, title: string, body: string): TourStep => ({id, target, title, body});
  return [
    step("welcome", "chat-composer", t("tour.chat.welcomeTitle"), t("tour.chat.welcomeBody")),
    step("navigation", "navbar", t("tour.chat.navigationTitle"), t("tour.chat.navigationBody")),
    step("projects", "navbar", t("tour.chat.projectsTitle"), t("tour.chat.projectsBody")),
    step("model", "chat-model-selector", t("tour.chat.modelTitle"), t("tour.chat.modelBody")),
    step("workspace", "chat-workspace", t("tour.chat.workspaceTitle"), t("tour.chat.workspaceBody")),
    step("permissions", "chat-permissions", t("tour.chat.permissionsTitle"), t("tour.chat.permissionsBody")),
    step("search", "chat-search", t("tour.chat.searchTitle"), t("tour.chat.searchBody")),
    step("attachments", "chat-plus-menu", t("tour.chat.plusMenuTitle"), t("tour.chat.plusMenuBody")),
    step("panels", "chat-new-panel", t("tour.chat.panelsTitle"), t("tour.chat.panelsBody")),
    step("activity", "chat-interface", t("tour.chat.activityTitle"), t("tour.chat.activityBody")),
    step("visuals", "chat-interface", t("tour.chat.visualsTitle"), t("tour.chat.visualsBody")),
    step("finish", "chat-composer", t("tour.chat.finishTitle"), t("tour.chat.finishBody")),
  ];
}
