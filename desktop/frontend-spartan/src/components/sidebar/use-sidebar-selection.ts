/**
 * Sparta Agent – Sidebar Selection Hook
 *
 * Hook para la gestión de multi-selección de chats y proyectos en la barra lateral,
 * rangos con Shift/Meta, deselección con Escape y clics contextuales.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectRecord, SidebarItem } from "@/features/chat";
import { rangeBetween, toggleSelected } from "@/features/chat";
import { SELECT_WITH_META } from "./sidebar-types-and-constants";

export function useSidebarSelection({
  allChatItems,
  projects,
  projectRowIds,
}: {
  allChatItems: SidebarItem[];
  projects: ProjectRecord[];
  projectRowIds: string[];
}) {
  const [selectedChatIds, setSelectedChatIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const selectionAnchorRef = useRef<{ scope: string; id: string } | null>(null);
  const selectedChatItems = useMemo(
    () => allChatItems.filter((item) => selectedChatIds.has(item.id)),
    [allChatItems, selectedChatIds],
  );
  const selectionCount = selectedChatItems.length;

  const [selectedProjectIds, setSelectedProjectIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const projectAnchorRef = useRef<string | null>(null);
  const selectedProjectRecords = useMemo(
    () => projects.filter((project) => selectedProjectIds.has(project.id)),
    [projects, selectedProjectIds],
  );
  const projectSelectionCount = selectedProjectRecords.length;

  const dropChatSelection = useCallback(() => {
    selectionAnchorRef.current = null;
    setSelectedChatIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const dropProjectSelection = useCallback(() => {
    projectAnchorRef.current = null;
    setSelectedProjectIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const clearSelection = useCallback(() => {
    dropChatSelection();
    dropProjectSelection();
  }, [dropChatSelection, dropProjectSelection]);

  useEffect(() => {
    if (selectionCount === 0 && projectSelectionCount === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectionCount, projectSelectionCount, clearSelection]);

  function handleSelectionClick(
    event: React.MouseEvent,
    item: SidebarItem,
    list: { scope: string; ids: string[] },
  ): boolean {
    dropProjectSelection();
    if (SELECT_WITH_META ? event.metaKey : event.ctrlKey) {
      setSelectedChatIds((prev) => toggleSelected(prev, item.id));
      selectionAnchorRef.current = { scope: list.scope, id: item.id };
      return true;
    }
    if (!event.shiftKey) return false;
    const anchor = selectionAnchorRef.current;
    const sameList = anchor?.scope === list.scope;
    if (!sameList)
      selectionAnchorRef.current = { scope: list.scope, id: item.id };
    setSelectedChatIds(
      new Set(
        sameList && anchor
          ? rangeBetween(list.ids, anchor.id, item.id)
          : [item.id],
      ),
    );
    return true;
  }

  function selectForContextMenu(
    item: SidebarItem,
    list: { scope: string; ids: string[] },
  ) {
    dropProjectSelection();
    if (selectedChatIds.has(item.id)) return;
    selectionAnchorRef.current = { scope: list.scope, id: item.id };
    setSelectedChatIds(new Set([item.id]));
  }

  function handleProjectSelectionClick(
    event: React.MouseEvent,
    projectId: string,
  ): boolean {
    const additive = SELECT_WITH_META ? event.metaKey : event.ctrlKey;
    if (!additive && !event.shiftKey) return false;
    dropChatSelection();
    if (additive) {
      setSelectedProjectIds((prev) => toggleSelected(prev, projectId));
      projectAnchorRef.current = projectId;
      return true;
    }
    const anchorId = projectAnchorRef.current;
    if (!anchorId) projectAnchorRef.current = projectId;
    setSelectedProjectIds(
      new Set(
        anchorId
          ? rangeBetween(projectRowIds, anchorId, projectId)
          : [projectId],
      ),
    );
    return true;
  }

  function selectProjectForContextMenu(projectId: string) {
    dropChatSelection();
    if (selectedProjectIds.has(projectId)) return;
    projectAnchorRef.current = projectId;
    setSelectedProjectIds(new Set([projectId]));
  }

  return {
    selectedChatIds,
    setSelectedChatIds,
    selectedChatItems,
    selectionCount,
    selectedProjectIds,
    setSelectedProjectIds,
    selectedProjectRecords,
    projectSelectionCount,
    dropChatSelection,
    dropProjectSelection,
    clearSelection,
    handleSelectionClick,
    selectForContextMenu,
    handleProjectSelectionClick,
    selectProjectForContextMenu,
  };
}
