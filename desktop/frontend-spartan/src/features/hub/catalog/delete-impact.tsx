import { useT as useUiT } from "@/i18n";
import { formatBytes } from "@/features/hub/lib/format";
import { useEffect, useState } from "react";
import { type DeleteImpact, fetchDeleteImpact } from "../inventory";

/**
 * Load the delete preview for a confirm dialog while it is open.
 *
 * An image GGUF is a small checkpoint plus a much larger companion base repo (text encoders,
 * VAE, tokenizer) shared by every quant of its family, so "removes it from disk" was never the
 * whole story: it could free 2.6 GB and silently leave 8.2 GB behind. Returns `null` until the
 * preview lands and if it fails, so the dialog opens either way.
 */
export function useDeleteImpact(
  open: boolean,
  repoId: string,
  variant?: string | null,
): DeleteImpact | null {
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  useEffect(() => {
    if (!open) {
      setImpact(null);
      return;
    }
    let cancelled = false;
    void fetchDeleteImpact(repoId, variant ?? undefined).then((result) => {
      if (!cancelled) {
        setImpact(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, repoId, variant]);
  return impact;
}

function joinNames(names: string[]): string {
  if (names.length <= 2) {
    return names.join(" and ");
  }
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/**
 * The truthful half of a delete confirmation: what comes back, and what does not.
 *
 * Deliberately says the retained number out loud even when it dwarfs the reclaimed one, and
 * says nothing at all rather than guess when the preview is unavailable.
 */
export function DeleteImpactSummary({
  impact,
}: { impact: DeleteImpact | null }) {
  const uiT = useUiT();

  if (!impact) {
    return null;
  }
  if (impact.blocked_by.length > 0) {
    return (
      <span className="mt-2 block text-ui-12p5 text-destructive">
        {uiT("ui.these_are_shared_assets_that")}{" "}{joinNames(impact.blocked_by)} {" "}{uiT("ui.still_needs_so_they_cannot_be_removed_yet_delete_those_models_fir")}</span>
    );
  }
  const retained = impact.retained_companions.reduce(
    (sum, c) => sum + c.size_bytes,
    0,
  );
  const freeable = impact.freeable_companions.reduce(
    (sum, c) => sum + c.size_bytes,
    0,
  );
  return (
    <span className="mt-2 block space-y-1 text-ui-12p5">
      <span
        className="block text-foreground"
        data-testid="delete-impact-reclaimed"
      >
        {uiT("ui.frees")}{" "}{formatBytes(impact.reclaimed_bytes)} {" "}{uiT("ui.of_disk_space")}</span>
      {retained > 0 ? (
        <span
          className="block text-muted-foreground"
          data-testid="delete-impact-retained"
        >
          {formatBytes(retained)} {" "}{uiT("ui.of_shared_assets_stay_on_disk")}{" "}
          {joinNames(impact.retained_companions.map((c) => c.repo_id))} {" "}{uiT("ui.is_still_needed_by")}{" "}
          {joinNames(
            Array.from(
              new Set(impact.retained_companions.flatMap((c) => c.needed_by)),
            ),
          )}
          .
        </span>
      ) : null}
      {freeable > 0 ? (
        <span
          className="block text-muted-foreground"
          data-testid="delete-impact-freeable"
        >
          {uiT("ui.this_also_leaves")}{" "}{formatBytes(freeable)} {" "}{uiT("ui.of_shared_assets")}{joinNames(impact.freeable_companions.map((c) => c.repo_id))}{uiT("ui.that_nothing_else_needs_remove_them_with_free_up_space_on_the_on_")}</span>
      ) : null}
    </span>
  );
}
