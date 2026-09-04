/**
 * Sparta Agent - Pila Visual de la Cola de Prompts (PromptQueueStack)
 * Renderiza la lista flotante de turnos encolados con soporte para edición,
 * eliminación, drag-and-drop y atajos de teclado.
 */

import {
  useRef,
  useState,
  useEffect,
  type FC,
  type DragEvent as ReactDragEvent,
} from "react";
import { CornerDownRightIcon } from "lucide-react";
import {
  Delete02Icon,
  Edit03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
  PROMPT_QUEUE_DRAG_TYPE,
  isPromptQueueDragTypes,
} from "@/features/chat";
import {
  usePromptQueueUI,
  type PromptQueueUIItem,
  type PromptQueueUIItemStatus,
} from "@/features/chat/stores/prompt-queue-ui-store";
import { cn } from "@/lib/utils";
import {
  editPromptQueueItem,
  findPromptQueueEntry,
  movePromptQueueItem,
  removePromptQueueItem,
} from "./prompt-queue-manager";

export function promptQueueStatusLabel(
  status: PromptQueueUIItemStatus,
): string {
  switch (status) {
    case "running":
      return "Running now";
    case "waiting":
      return "Waiting";
    case "next":
      return "Next";
    case "queued":
      return "Queued";
    default: {
      const exhaustiveStatus: never = status;
      throw new Error(`Unhandled prompt queue status: ${exhaustiveStatus}`);
    }
  }
}

export function isPromptQueueDrag(event: ReactDragEvent): boolean {
  return isPromptQueueDragTypes(event.dataTransfer?.types);
}

export interface PromptQueueStackProps {
  queueThreadIds: string[];
}

export const PromptQueueStack: FC<PromptQueueStackProps> = ({
  queueThreadIds,
}) => {
  const queueEntry = usePromptQueueUI((s) =>
    findPromptQueueEntry(s, queueThreadIds),
  );
  const items = usePromptQueueUI((s) => s.items);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const visibleItems = queueEntry
    ? items.filter((item) => item.runId === queueEntry.runId)
    : [];
  const editingItem = visibleItems.find((item) => item.id === editingItemId);
  const activeEditingItemId = editingItem ? editingItemId : null;

  useEffect(() => {
    if (!activeEditingItemId) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [activeEditingItemId]);

  if (!queueEntry || visibleItems.length === 0) {
    return null;
  }

  const { current, total } = queueEntry;

  const startEditing = (item: PromptQueueUIItem) => {
    if (!item.canEdit) return;
    setEditingItemId(item.id);
    setDraftPrompt(item.prompt);
  };

  const saveEditing = () => {
    if (!activeEditingItemId) return;
    if (editPromptQueueItem(activeEditingItemId, draftPrompt)) {
      setEditingItemId(null);
      setDraftPrompt("");
    }
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setDraftPrompt("");
  };

  const endDrag = () => {
    setDraggingItemId(null);
    setDragOverItemId(null);
  };

  const moveByOffset = (index: number, offset: number) => {
    const target = visibleItems[index + offset];
    if (!target) return;
    movePromptQueueItem(visibleItems[index].id, target.id);
  };

  const reorderable = visibleItems.length > 1;

  return (
    <div
      className="relative z-0 mx-7 mb-[-8px] max-h-[28dvh] overflow-y-auto rounded-t-[18px] rounded-b-none border border-border/45 bg-background/90 px-5 py-2 text-muted-foreground shadow-none backdrop-blur-md dark:bg-card/85"
      aria-label={`Prompt queue, ${current} of ${total}`}
    >
      <div className="divide-y divide-border/25">
        {visibleItems.map((item, visibleIndex) => {
          const isEditing = item.id === activeEditingItemId;
          const visiblePosition = visibleIndex + 1;
          return (
            <div
              key={item.id}
              className={cn(
                "min-h-10",
                isEditing ? "h-auto" : "h-10",
                draggingItemId === item.id && "opacity-40",
                dragOverItemId === item.id &&
                  draggingItemId !== item.id &&
                  "rounded-md ring-1 ring-ring/60",
              )}
              draggable={reorderable && !isEditing}
              onDragStart={(event) => {
                setDraggingItemId(item.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(PROMPT_QUEUE_DRAG_TYPE, item.id);
              }}
              onDragEnd={endDrag}
              onDragOver={(event) => {
                if (!isPromptQueueDrag(event) || draggingItemId === item.id) {
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverItemId(item.id);
              }}
              onDragLeave={() => {
                setDragOverItemId((id) => (id === item.id ? null : id));
              }}
              onDrop={(event) => {
                if (!isPromptQueueDrag(event)) return;
                event.preventDefault();
                const sourceId =
                  event.dataTransfer.getData(PROMPT_QUEUE_DRAG_TYPE) ||
                  draggingItemId;
                if (sourceId) {
                  movePromptQueueItem(sourceId, item.id);
                }
                endDrag();
              }}
              aria-label={`${promptQueueStatusLabel(item.status)} prompt ${visiblePosition} of ${visibleItems.length}: ${item.prompt}`}
            >
              {isEditing ? (
                <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 py-1">
                  <textarea
                    ref={editInputRef}
                    value={draftPrompt}
                    rows={1}
                    onChange={(event) =>
                      setDraftPrompt(event.currentTarget.value)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        (event.metaKey || event.ctrlKey)
                      ) {
                        event.preventDefault();
                        saveEditing();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEditing();
                      }
                    }}
                    className="max-h-20 min-h-8 min-w-0 resize-none rounded-md border border-border/45 bg-transparent px-2 py-1.5 text-sm leading-5 text-foreground outline-none transition-colors focus-visible:border-ring"
                    aria-label={`Edit queued prompt ${visiblePosition}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={cancelEditing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={draftPrompt.trim().length === 0}
                    onClick={saveEditing}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <div className="grid h-10 grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {reorderable ? (
                      <button
                        type="button"
                        className="shrink-0 cursor-grab text-muted-foreground/50 outline-none hover:text-muted-foreground focus-visible:text-foreground active:cursor-grabbing"
                        aria-label={`Reorder queued prompt ${visiblePosition} of ${visibleItems.length}`}
                        onKeyDown={(event) => {
                          if (
                            event.key !== "ArrowUp" &&
                            event.key !== "ArrowDown"
                          ) {
                            return;
                          }
                          event.preventDefault();
                          moveByOffset(
                            visibleIndex,
                            event.key === "ArrowUp" ? -1 : 1,
                          );
                        }}
                      >
                        <CornerDownRightIcon className="size-4" />
                      </button>
                    ) : (
                      <CornerDownRightIcon className="size-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <div className="truncate text-sm text-muted-foreground">
                      {item.prompt}
                    </div>
                  </div>
                  {item.canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-[5.25rem] justify-center gap-1 px-0 text-sm font-normal text-muted-foreground/80 hover:text-foreground"
                      onClick={() => startEditing(item)}
                    >
                      <HugeiconsIcon icon={Edit03Icon} strokeWidth={2} />
                      Edit
                    </Button>
                  ) : null}
                  <TooltipIconButton
                    tooltip="Remove from queue"
                    side="bottom"
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-start-3 size-7 justify-self-center text-muted-foreground/70 hover:text-destructive"
                    aria-label={`Remove queued prompt ${visiblePosition}`}
                    disabled={!item.canRemove}
                    onClick={() => removePromptQueueItem(item.id)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  </TooltipIconButton>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
