import type { TourStep } from "@/features/tour";
import type { useT } from "@/i18n";

export function buildChatTourSteps({
  t,
  canCompare,
  enterCompare,
  exitCompare,
}: {
  t?: ReturnType<typeof useT>;
  canCompare: boolean;
  enterCompare: () => void;
  exitCompare: () => void;
}): TourStep[] {
  const tr = (key: string, fallback: string) =>
    t ? (t(key as any) as string) : fallback;

  const steps: TourStep[] = [
    {
      id: "model",
      target: "chat-model-selector",
      title: tr("tour.chat.modelTitle", "Choose an API model"),
      body: tr(
        "tour.chat.modelBody",
        "Choose a model enabled on one of your configured API providers. Models run on the provider; Sparta does not download or load them on this device.",
      ),
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
