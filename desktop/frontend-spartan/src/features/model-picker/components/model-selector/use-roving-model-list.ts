/**
 * Sparta Agent – Model Selector Keyboard Navigation Hook
 *
 * Hook de navegación por teclado accesible (roving tabindex) para las listas de modelos:
 * - Soporte para flechas Arriba/Abajo, Inicio/Fin y callbacks para traspaso entre listas.
 * - Generación de identificadores DOM estables para aria-activedescendant y foco directo.
 * - Helpers para asociación padre-hijo (makeModelOptionKey, makeModelOptionChildrenId, focusFirstChildOption).
 */

import { useCallback, useId, useState, type KeyboardEvent } from "react";
import type { ModelRowOptionProps } from "./model-row";

export function makeModelOptionKey(section: string, id: string): string {
  return `${section}::${id}`;
}

export function makeModelOptionChildrenId(optionKey: string): string {
  return `model-picker-children-${optionKey.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

export function focusFirstChildOption(optionKey: string): boolean {
  const childList = document.getElementById(
    makeModelOptionChildrenId(optionKey),
  );
  const option = childList?.querySelector<HTMLElement>(
    "[data-model-picker-option]",
  );
  if (!option) {
    return false;
  }
  option.focus();
  return true;
}

export function useRovingModelList({
  label,
  optionKeys,
  selectedOptionKey,
  onNavigatePastStart,
  onNavigatePastEnd,
}: {
  label: string;
  optionKeys: string[];
  selectedOptionKey?: string;
  onNavigatePastStart?: () => void;
  onNavigatePastEnd?: () => void;
}) {
  const rawListboxId = useId();
  const listboxId = `model-picker-${rawListboxId.replace(/:/g, "")}`;
  const [rovingOptionKey, setRovingOptionKey] = useState<string | null>(null);

  const preferredOptionKey =
    selectedOptionKey && optionKeys.includes(selectedOptionKey)
      ? selectedOptionKey
      : (optionKeys[0] ?? null);
  const activeOptionKey =
    rovingOptionKey && optionKeys.includes(rovingOptionKey)
      ? rovingOptionKey
      : preferredOptionKey;

  const getOptionDomId = useCallback(
    (optionKey: string) => {
      const index = optionKeys.indexOf(optionKey);
      return index === -1 ? undefined : `${listboxId}-option-${index}`;
    },
    [listboxId, optionKeys],
  );

  const focusOption = useCallback(
    (optionKey: string) => {
      const id = getOptionDomId(optionKey);
      if (!id) {
        return;
      }
      document.getElementById(id)?.focus();
    },
    [getOptionDomId],
  );

  const moveFocus = useCallback(
    (
      fromOptionKey: string,
      direction: "next" | "previous" | "first" | "last",
    ) => {
      if (optionKeys.length === 0) {
        return;
      }

      const currentIndex = optionKeys.indexOf(fromOptionKey);
      let nextIndex = currentIndex === -1 ? 0 : currentIndex;
      if (direction === "next") {
        if (currentIndex >= optionKeys.length - 1) {
          onNavigatePastEnd?.();
          return;
        }
        nextIndex = Math.min(optionKeys.length - 1, nextIndex + 1);
      } else if (direction === "previous") {
        if (currentIndex <= 0) {
          onNavigatePastStart?.();
          return;
        }
        nextIndex = Math.max(0, nextIndex - 1);
      } else if (direction === "first") {
        nextIndex = 0;
      } else {
        nextIndex = optionKeys.length - 1;
      }

      const nextOptionKey = optionKeys[nextIndex];
      setRovingOptionKey(nextOptionKey);
      focusOption(nextOptionKey);
    },
    [focusOption, onNavigatePastEnd, onNavigatePastStart, optionKeys],
  );

  const getOptionProps = useCallback(
    (optionKey: string, selected: boolean): ModelRowOptionProps => ({
      id: getOptionDomId(optionKey) ?? `${listboxId}-option-missing`,
      tabIndex: 0,
      onFocus: () => {
        setRovingOptionKey(optionKey);
      },
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(optionKey, "next");
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(optionKey, "previous");
        } else if (event.key === "Home") {
          event.preventDefault();
          moveFocus(optionKey, "first");
        } else if (event.key === "End") {
          event.preventDefault();
          moveFocus(optionKey, "last");
        }
      },
      "data-model-picker-option": true,
      "data-model-picker-active-option":
        optionKey === activeOptionKey ? "true" : undefined,
      "aria-current": selected ? "true" : undefined,
    }),
    [activeOptionKey, getOptionDomId, listboxId, moveFocus],
  );

  return {
    activeOptionKey,
    focusOption,
    getOptionProps,
    moveFocus,
    listboxProps: {
      id: listboxId,
      "data-model-picker-list": true,
      "aria-label": label,
    },
  };
}
