/**
 * Sparta Agent – Compare Prompt Queue Hook
 *
 * Hook dedicado a la gestión de la cola de prompts secuenciales
 * durante el modo de comparación entre modelos.
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { toast } from "@/lib/toast";

export interface UseComparePromptQueueOptions {
  running: boolean;
  comparing: boolean;
  setText: (text: string) => void;
  sendRef: MutableRefObject<(() => void) | null>;
  compareStepSucceededRef: MutableRefObject<boolean>;
}

export function useComparePromptQueue({
  running,
  comparing,
  setText,
  sendRef,
  compareStepSucceededRef,
}: UseComparePromptQueueOptions) {
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const queueRef = useRef<string[]>([]);
  const queueIndexRef = useRef(0);
  const isQueueRunningRef = useRef(false);
  const prevRunningRef = useRef(false);
  const prevComparingRef = useRef(false);

  const resetPromptQueue = useCallback(() => {
    if (!isQueueRunningRef.current && queueRef.current.length === 0) {
      return;
    }
    isQueueRunningRef.current = false;
    setIsQueueRunning(false);
    queueRef.current = [];
    queueIndexRef.current = 0;
    setQueueProgress({ current: 0, total: 0 });
  }, []);

  const advanceQueue = useCallback(() => {
    const nextIndex = queueIndexRef.current + 1;
    if (nextIndex >= queueRef.current.length) {
      resetPromptQueue();
      toast.success("Prompt queue complete");
      return;
    }
    queueIndexRef.current = nextIndex;
    setQueueProgress({ current: nextIndex + 1, total: queueRef.current.length });
    const next = queueRef.current[nextIndex];
    toast(`Prompt ${nextIndex + 1} / ${queueRef.current.length}`, {
      description: next.length > 80 ? next.slice(0, 80) + "…" : next,
    });
    setText(next);
    setTimeout(() => {
      sendRef.current?.();
    }, 100);
  }, [resetPromptQueue, sendRef, setText]);

  const startQueue = useCallback(
    (items: string[]) => {
      const filtered = items.filter((p) => p.trim());
      if (!filtered.length) return false;
      queueRef.current = filtered;
      queueIndexRef.current = 0;
      isQueueRunningRef.current = true;
      setIsQueueRunning(true);
      setQueueProgress({ current: 1, total: filtered.length });
      toast(`Prompt 1 / ${filtered.length}`, {
        description:
          filtered[0].length > 80 ? filtered[0].slice(0, 80) + "…" : filtered[0],
      });
      setText(filtered[0]);
      setTimeout(() => {
        sendRef.current?.();
      }, 100);
      return true;
    },
    [sendRef, setText],
  );

  // Avanzar la cola en modo compare cuando el paso concluye exitosamente
  useEffect(() => {
    const wasComparing = prevComparingRef.current;
    prevComparingRef.current = comparing;
    if (!isQueueRunningRef.current || !wasComparing || comparing) return;
    if (!compareStepSucceededRef.current) {
      resetPromptQueue();
      toast.error("Prompt queue stopped", {
        description: "A compare step failed; remaining prompts were not sent.",
      });
      return;
    }
    prevRunningRef.current = false;
    advanceQueue();
  }, [comparing, advanceQueue, resetPromptQueue, compareStepSucceededRef]);

  // Avanzar en modo no-compare cuando la ejecución termina
  useEffect(() => {
    const wasRunning = prevRunningRef.current;
    prevRunningRef.current = running;
    if (!isQueueRunningRef.current || !wasRunning || running || comparing) return;
    advanceQueue();
  }, [running, comparing, advanceQueue]);

  return {
    isQueueRunning,
    queueProgress,
    startQueue,
    resetPromptQueue,
  };
}
