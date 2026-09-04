/**
 * Sparta Agent - Hook de Manejo de Entrada de Texto e IME (useImeComposer)
 * Previene pérdidas de texto o envíos prematuros durante composición con IME
 * (japonés, chino, coreano) y maneja atajos de teclado Enter / Mod+Enter.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useAui } from "@assistant-ui/react";
import { flushResourcesSync } from "@assistant-ui/tap";
import { isPromptQueueChord } from "@/features/chat";
import {
  applySentTextGuard,
  isGuardRetiringKey,
  markSentTextGuardUserInput,
  type SentTextGuard,
} from "@/features/chat/utils/composer-send-guard";

export function isNativeComposing(event: Event): boolean {
  return "isComposing" in event && (event as InputEvent).isComposing === true;
}

export function isTextReplacement(event: Event | undefined): boolean {
  return inputTypeOf(event) === "insertReplacementText";
}

export function isCompositionWrite(event: Event | undefined): boolean {
  return (
    inputTypeOf(event) === "insertCompositionText" ||
    event?.type === "compositionend" ||
    (event !== undefined && isNativeComposing(event))
  );
}

export const DELIBERATE_INPUT_TYPES = new Set([
  "historyUndo",
  "historyRedo",
  "insertFromPaste",
  "insertFromDrop",
  "insertFromYank",
]);

export function isDeliberateWrite(event: Event | undefined): boolean {
  return DELIBERATE_INPUT_TYPES.has(inputTypeOf(event) ?? "");
}

export function inputTypeOf(event: Event | undefined): string | undefined {
  if (event === undefined || !("inputType" in event)) return undefined;
  return (event as InputEvent).inputType;
}

export const IME_STUCK_TIMEOUT_MS = 2500;

export interface UseImeComposerInputHandlersOptions {
  submitOnEnter?: boolean;
  onModEnter?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  justSentRef?: RefObject<SentTextGuard | null>;
  draftKeyRef?: RefObject<string | null>;
}

export function useImeComposerInputHandlers({
  submitOnEnter = false,
  onModEnter,
  justSentRef,
  draftKeyRef,
}: UseImeComposerInputHandlersOptions = {}) {
  const aui = useAui();
  const composingRef = useRef(false);
  const [isComposing, setIsComposing] = useState(false);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStuckTimer = useCallback(() => {
    if (stuckTimerRef.current) {
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
    }
  }, []);

  const setCompositionState = useCallback(
    (next: boolean) => {
      composingRef.current = next;
      setIsComposing(next);
      clearStuckTimer();
      if (next) {
        stuckTimerRef.current = setTimeout(() => {
          stuckTimerRef.current = null;
          composingRef.current = false;
          setIsComposing(false);
        }, IME_STUCK_TIMEOUT_MS);
      }
    },
    [clearStuckTimer],
  );

  const refreshStuckTimer = useCallback(() => {
    if (!composingRef.current) {
      return;
    }
    clearStuckTimer();
    stuckTimerRef.current = setTimeout(() => {
      stuckTimerRef.current = null;
      composingRef.current = false;
      setIsComposing(false);
    }, IME_STUCK_TIMEOUT_MS);
  }, [clearStuckTimer]);

  useEffect(() => clearStuckTimer, [clearStuckTimer]);

  const setComposerText = useCallback(
    (value: string, nativeEvent?: Event): boolean => {
      const composer = aui.composer();
      if (!composer.getState().isEditing) {
        return false;
      }
      const guardOwnsThread =
        justSentRef?.current == null ||
        draftKeyRef === undefined ||
        justSentRef.current.draftKey === draftKeyRef.current;
      if (justSentRef && guardOwnsThread) {
        const result = applySentTextGuard(justSentRef.current, {
          value,
          replacesText: isTextReplacement(nativeEvent),
          isDeliberate: isDeliberateWrite(nativeEvent),
          isComposition: isCompositionWrite(nativeEvent),
          composerIsEmpty: composer.getState().text.length === 0,
        });
        justSentRef.current = result.guard;
        if (!result.accept) {
          return false;
        }
      }
      flushResourcesSync(() => {
        composer.setText(value);
      });
      return true;
    },
    [aui, draftKeyRef, justSentRef],
  );

  const onCompositionStart = useCallback(() => {
    if (justSentRef) {
      justSentRef.current = markSentTextGuardUserInput(justSentRef.current);
    }
    setCompositionState(true);
  }, [justSentRef, setCompositionState]);

  const onCompositionUpdate = useCallback(() => {
    refreshStuckTimer();
  }, [refreshStuckTimer]);

  const onCompositionEnd = useCallback(
    (e: CompositionEvent<HTMLTextAreaElement>) => {
      setCompositionState(false);
      if (!setComposerText(e.currentTarget.value, e.nativeEvent)) {
        e.preventDefault();
      }
    },
    [setComposerText, setCompositionState],
  );

  const onChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setCompositionState(isNativeComposing(e.nativeEvent));
      if (!setComposerText(e.target.value, e.nativeEvent)) {
        e.preventDefault();
      }
    },
    [setComposerText, setCompositionState],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) {
        composingRef.current = true;
        refreshStuckTimer();
        return;
      }
      if (justSentRef && isGuardRetiringKey(e)) {
        justSentRef.current = markSentTextGuardUserInput(justSentRef.current);
      }
      if (composingRef.current) {
        if (e.key === "Enter") {
          if (!e.shiftKey) {
            e.preventDefault();
          }
          refreshStuckTimer();
          return;
        }
        setCompositionState(false);
      }
      if (onModEnter && isPromptQueueChord(e)) {
        e.preventDefault();
        onModEnter(e);
        return;
      }
      if (submitOnEnter && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.currentTarget.form?.requestSubmit();
      }
    },
    [
      justSentRef,
      onModEnter,
      refreshStuckTimer,
      setCompositionState,
      submitOnEnter,
    ],
  );

  const onBlur = useCallback(() => {
    setCompositionState(false);
  }, [setCompositionState]);

  return {
    inputProps: {
      onCompositionStart,
      onCompositionUpdate,
      onCompositionEnd,
      onChange,
      onKeyDown,
      onBlur,
    },
    isComposing,
    isComposingRef: composingRef,
  };
}
