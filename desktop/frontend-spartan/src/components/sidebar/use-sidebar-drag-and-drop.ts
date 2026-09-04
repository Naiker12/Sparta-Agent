/**
 * Sparta Agent – Sidebar Drag & Drop Hook
 *
 * Hook para la gestión de reordenamiento manual mediante Drag and Drop en HTML5,
 * soporte de indicadores visuales (drop cues) y menú alternativo para teclados/pantallas táctiles.
 */

import { useState } from "react";
import { dropEdgeFor, moveIdBy, reorderIds } from "@/features/chat";
import {
  DROP_CUE_BOTTOM,
  DROP_CUE_TOP,
} from "./sidebar-types-and-constants";

export function useSidebarDragAndDrop({
  setManualOrder,
}: {
  setManualOrder: (scope: string, next: string[]) => void;
}) {
  const [draggingRow, setDraggingRow] = useState<{
    id: string;
    scope: string;
  } | null>(null);
  const [dropTargetRowId, setDropTargetRowId] = useState<string | null>(null);

  function dropCueClass(
    scope: string | undefined,
    orderedIds: string[] | undefined,
    rowId: string,
  ): string | undefined {
    if (
      scope === undefined ||
      dropTargetRowId !== rowId ||
      draggingRow?.scope !== scope ||
      draggingRow.id === rowId
    ) {
      return undefined;
    }
    return dropEdgeFor(orderedIds ?? [], draggingRow.id, rowId) === "bottom"
      ? DROP_CUE_BOTTOM
      : DROP_CUE_TOP;
  }

  function moveRowItem(
    scope: string,
    orderedIds: string[],
    rowId: string,
    delta: number,
  ) {
    const next = moveIdBy(orderedIds, rowId, delta);
    if (next !== orderedIds) setManualOrder(scope, next);
  }

  function rowDragProps(scope: string, orderedIds: string[], rowId: string) {
    return {
      draggable: true,
      onDragStart: (event: React.DragEvent) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", rowId);
        setDraggingRow({ id: rowId, scope });
      },
      onDragEnd: () => {
        setDraggingRow(null);
        setDropTargetRowId(null);
      },
      onDragOver: (event: React.DragEvent) => {
        if (draggingRow?.scope !== scope) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dropTargetRowId !== rowId) setDropTargetRowId(rowId);
      },
      onDragLeave: () => {
        setDropTargetRowId((prev) => (prev === rowId ? null : prev));
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        const dragged = draggingRow;
        setDraggingRow(null);
        setDropTargetRowId(null);
        if (!dragged || dragged.scope !== scope) return;
        const next = reorderIds(orderedIds, dragged.id, rowId);
        if (next !== orderedIds) setManualOrder(scope, next);
      },
    };
  }

  return {
    draggingRow,
    dropTargetRowId,
    dropCueClass,
    moveRowItem,
    rowDragProps,
  };
}
