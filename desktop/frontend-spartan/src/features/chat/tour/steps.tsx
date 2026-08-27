
import type { TourStep } from "@/features/tour";
import type { useT } from "@/i18n";

export function buildChatTourSteps({
  t,
  canCompare,
  openModelSelector,
  closeModelSelector,
  openSettings,
  closeSettings,
  enterCompare,
  exitCompare,
}: {
  t?: ReturnType<typeof useT>;
  canCompare: boolean;
  openModelSelector: () => void;
  closeModelSelector: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  enterCompare: () => void;
  exitCompare: () => void;
}): TourStep[] {
  const tr = (key: string, fallback: string) =>
    t ? (t(key as any) as string) : fallback;

  const steps: TourStep[] = [
    {
      id: "model",
      target: "chat-model-selector",
      title: tr("tour.chat.modelTitle", "Pick a model"),
      body: tr(
        "tour.chat.modelBody",
        "Selects what’s loaded for inference. Recommended is Sparta’s curated base models; On Device is your downloads and fine-tuned outputs (LoRA adapters and full finetunes).",
      ),
    },
    {
      id: "model-tabs",
      target: "chat-model-selector-popover",
      title: tr("tour.chat.modelTabsTitle", "Find a model"),
      body: tr(
        "tour.chat.modelTabsBody",
        "Search Sparta’s models, or hit Search Hub for all of Hugging Face. Switch Recommended and On Device, filter by format, and sort by trending or recent. An OOM tag means it won’t fit in your VRAM.",
      ),
      onEnter: openModelSelector,
      onExit: closeModelSelector,
    },
    {
      id: "settings",
      target: "chat-settings",
      title: tr("tour.chat.settingsTitle", "Settings sidebar"),
      body: tr(
        "tour.chat.settingsBody",
        "Sampling (temperature/top-p/top-k) + system prompt live here. If you want more deterministic outputs, lower temperature first.",
      ),
      onEnter: openSettings,
      onExit: closeSettings,
    },
    {
      id: "plus-menu",
      target: "chat-plus-menu",
      title: tr("tour.chat.plusMenuTitle", "The + menu"),
      body: tr(
        "tour.chat.plusMenuBody",
        "Everything else lives here: attach photos and files, reuse saved prompts, toggle tools and MCP, start a side-by-side compare, and export the chat.",
      ),
    },
  ];

  if (canCompare) {
    // Compare lives in the + menu (no sidebar button to anchor to); this step
    // enters compare on its own and explains it.
    steps.push({
      id: "compare-view",
      target: "chat-compare-view",
      title: tr("tour.chat.compareViewTitle", "Side-by-side threads"),
      body: tr(
        "tour.chat.compareViewBody",
        "Compare any two models side-by-side, available from the + menu. Same prompt, 2 threads. If LoRA is worse than base, it’s usually data formatting, too many epochs, or a bad checkpoint choice.",
      ),
      onEnter: enterCompare,
      onExit: exitCompare,
    });
  }

  return steps;
}
