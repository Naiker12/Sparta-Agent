import { useCallback, useEffect, useMemo, useState } from "react";
import type { TourStep } from "../types";
import { hasSeenTour, rememberTour } from "../lib/tour-history";

export const TOUR_OPEN_EVENT = "omx:tour:open";

export type TourOpenDetail = {
  id?: string;
};

export function useGuidedTourController({
  id,
  steps,
  enabled = true,
  autoKey,
  autoWhen = false,
}: {
  id: string;
  steps: TourStep[];
  enabled?: boolean;
  autoKey?: string;
  autoWhen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hasRuntime, setHasRuntime] = useState(false);

  useEffect(() => setHasRuntime(true), []);

  useEffect(() => {
    if (!(hasRuntime && enabled)) {
      return;
    }
    if (!(autoKey && autoWhen)) {
      return;
    }
    if (steps.length === 0) {
      return;
    }
    if (hasSeenTour(autoKey)) {
      return;
    }
    rememberTour(autoKey, "shown");
    setOpen(true);
  }, [autoKey, autoWhen, enabled, hasRuntime, steps.length]);

  useEffect(() => {
    if (!(hasRuntime && enabled)) {
      return;
    }
    function onOpen(e: Event) {
      const ce = e as CustomEvent<TourOpenDetail>;
      if (ce.detail?.id && ce.detail.id !== id) {
        return;
      }
      if (steps.length === 0) {
        return;
      }
      if (autoKey) rememberTour(autoKey, "shown");
      setOpen(true);
    }
    window.addEventListener(TOUR_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(TOUR_OPEN_EVENT, onOpen);
  }, [autoKey, enabled, hasRuntime, id, steps.length]);

  const onSkip = useCallback(() => {
    if (!autoKey) {
      return;
    }
    rememberTour(autoKey, "skipped");
  }, [autoKey]);

  const onComplete = useCallback(() => {
    if (!autoKey) {
      return;
    }
    rememberTour(autoKey, "done");
  }, [autoKey]);

  const tourProps = useMemo(
    () => ({
      open,
      onOpenChange: setOpen,
      steps,
      onSkip,
      onComplete,
    }),
    [onComplete, onSkip, open, steps],
  );

  return { open, setOpen, onSkip, onComplete, tourProps };
}
