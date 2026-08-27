
import type { TourStep } from "@/features/tour";
import type { useT } from "@/i18n";

export function buildExportTourSteps(t?: ReturnType<typeof useT>): TourStep[] {
  const tr = (key: string, fallback: string) =>
    t ? (t(key as any) as string) : fallback;

  return [
    {
      id: "training-run",
      target: "export-training-run",
      title: tr("tour.export.trainingRunTitle", "Pick training run"),
      body: tr(
        "tour.export.trainingRunBody",
        "Start by selecting the training run. Each run groups the checkpoints produced by that specific fine-tuning job.",
      ),
    },
    {
      id: "checkpoint",
      target: "export-checkpoint",
      title: tr("tour.export.checkpointTitle", "Pick checkpoint"),
      body: tr(
        "tour.export.checkpointBody",
        "Pick which checkpoint to export. If you trained multiple checkpoints, it’s worth exporting 1-2 candidates and testing in Chat.",
      ),
    },
    {
      id: "method",
      target: "export-method",
      title: tr("tour.export.methodTitle", "Export method"),
      body: tr(
        "tour.export.methodBody",
        "Choose the packaging. GGUF is for llama.cpp-style runtimes (pick a quant). Safetensors is for HF/Transformers-style usage. If you’re unsure, start with safetensors.",
      ),
    },
    {
      id: "cta",
      target: "export-cta",
      title: tr("tour.export.ctaTitle", "Export"),
      body: tr(
        "tour.export.ctaBody",
        "Export to local or push to HF Hub. After export, test in Chat and compare against base to confirm behavior is what you expect.",
      ),
    },
  ];
}
export const exportTourSteps: TourStep[] = buildExportTourSteps();
