import { translateMemory as uiTranslate } from "./memory-i18n";
import { useMemoryT as useUiT } from "./memory-i18n";
import { useLocale } from "@/i18n";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authFetch } from "@/features/auth";
import { ExtractionReview } from "./extraction-review";
import {
  memoryTypeLabel,
  type MemoryDetail,
  type MemoryGraphData,
  type MemoryNode,
} from "./memory-types";

export function MemoryDetails({
  node,
  graph,
  saving,
  onClose,
  onSelect,
  onEdit,
  onRemove,
  onConnect,
  onRefresh,
}: {
  node: MemoryNode;
  graph: MemoryGraphData;
  saving: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onRemove: () => Promise<void>;
  onConnect: (target: string, relation: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
}) {
  const uiT = useUiT();
  const locale = useLocale();

  const [detail, setDetail] = useState<MemoryDetail | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [target, setTarget] = useState("");
  const [relation, setRelation] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await authFetch(
          `/api/memory/nodes/${encodeURIComponent(node.id)}`,
        );
        if (!response.ok)
          throw new Error(uiTranslate("ui.could_not_load_the_original_source"));
        const data = await response.json();
        if (active) {
          setDetail(data);
          setError("");
        }
      } catch (failure) {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : "Error al cargar detalle",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [node.id, graph]);
  const connected = graph.edges.filter(
    (edge) => edge.source === node.id || edge.target === node.id,
  );
  const displayContent = node.content
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/\n[\t ]*\n(?:[\t ]*\n)+/g, "\n\n");
  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label={uiT("ui.memory_details")}
    >
      <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
        <h2 className="text-sm font-semibold">
          {node.sourceMessageId
            ? uiT("ui.episode_details")
            : uiT("ui.memory_details")}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={uiT("ui.close_details")}
        >
          ×
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {node.sourceMessageId
              ? uiT("ui.episode")
              : memoryTypeLabel(node.type)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {node.sourceMessageId
              ? uiT("ui.conversation")
              : uiT("ui.saved_memory")}
          </span>
        </div>
        <h3 className="break-words text-lg font-semibold">{node.label}</h3>
        {displayContent && displayContent !== node.label.trim() && (
          <p className="shrink-0 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {displayContent}
          </p>
        )}
        <Separator />
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <h4 className="text-sm font-medium text-foreground">
            {uiT("exportPage.source")}
          </h4>
          <p>
            {node.sourceMessageId
              ? node.sourceRole === "assistant"
                ? uiT("ui.generated_response_episode")
                : uiT("ui.user_message_episode")
              : node.sourceRole
                ? uiT("ui.extracted_and_reviewed_unverified_claim")
                : uiT("ui.added_manually")}
          </p>
          <div className="flex items-center justify-between gap-3">
            <p>
              {node.projectId
                ? uiT("chat.projectSwitcher.project")
                : uiT("ui.personal")}
            </p>
            {node.updatedAt && (
              <time dateTime={new Date(node.updatedAt).toISOString()}>
                {new Date(node.updatedAt).toLocaleDateString(locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </time>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        {detail?.evidence?.map((source) => (
          <div key={source.sourceId} className="flex flex-col gap-2">
            <h4 className="text-sm font-medium">{uiT("ui.original_source")}</h4>
            <blockquote className="rounded-xl border bg-muted/30 p-3 text-sm">
              «{source.quote}»
            </blockquote>
            {source.sourceThreadId && (
              <Link
                to="/chat"
                search={{ thread: source.sourceThreadId }}
                className="text-xs text-primary"
              >
                {uiT("ui.open_conversation")}
              </Link>
            )}
          </div>
        ))}
        {node.sourceMessageId && node.sourceThreadId && (
          <Link
            to="/chat"
            search={{ thread: node.sourceThreadId }}
            className="text-xs text-primary"
          >
            {uiT("ui.open_original_conversation")}
          </Link>
        )}
        <Separator />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{uiT("ui.relationships")}</h4>
            <Badge variant="outline">{connected.length}</Badge>
          </div>
          {connected.length ? (
            connected.map((edge) => {
              const other = graph.nodes.find(
                (item) =>
                  item.id ===
                  (edge.source === node.id ? edge.target : edge.source),
              );
              return (
                other && (
                  <Button
                    key={edge.id}
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-xl border px-3 py-3 text-left"
                    onClick={() => onSelect(other.id)}
                    title={other.label}
                    aria-label={uiT("ui.open_relationship_value0", {
                      value0: String(other.label),
                    })}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="line-clamp-2 whitespace-normal break-words">
                        {other.label.replace(/\*\*/g, "")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {edge.source === node.id ? "→" : "←"} {edge.relation}
                      </span>
                    </span>
                  </Button>
                )
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground">
              {uiT("ui.no_saved_relationships")}
            </p>
          )}
        </div>
        <details>
          <summary className="cursor-pointer rounded-xl border px-3 py-2 text-sm">
            {uiT("ui.add_relationship")}
          </summary>
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await onConnect(target, relation.trim())) {
                setTarget("");
                setRelation("");
              }
            }}
          >
            <Select value={target} disabled={saving} onValueChange={setTarget}>
              <SelectTrigger
                aria-label={uiT("ui.related_memory")}
                className="w-full"
              >
                <SelectValue placeholder={uiT("ui.choose_memory")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {graph.nodes
                    .filter(
                      (other) =>
                        other.id !== node.id &&
                        other.projectId === node.projectId,
                    )
                    .map((other) => (
                      <SelectItem key={other.id} value={other.id}>
                        <span className="max-w-64 truncate">{other.label}</span>
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Input
              aria-label={uiT("ui.relationship_name")}
              maxLength={120}
              placeholder={uiT("ui.for_example_belongs_to")}
              value={relation}
              disabled={saving}
              onChange={(event) => setRelation(event.target.value)}
            />
            <Button size="sm" disabled={saving || !target || !relation.trim()}>
              {uiT("ui.save_relationship")}
            </Button>
          </form>
        </details>
        {node.sourceMessageId && (
          <details>
            <summary className="cursor-pointer rounded-xl border px-3 py-2 text-sm">
              {uiT("ui.extract_knowledge")}
              <span className="mt-1 block text-xs text-muted-foreground">
                {uiT("ui.get_proposals_to_review")}
              </span>
            </summary>
            <ExtractionReview nodeId={node.id} onSaved={onRefresh} />
          </details>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t bg-background p-4">
        {!node.sourceMessageId && (
          <Button variant="outline" disabled={saving} onClick={onEdit}>
            {uiT("ui.edit_memory")}
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={saving}
          onClick={() => setConfirmDelete(true)}
        >
          {uiT("chat.menu.delete")}{" "}
          {node.sourceMessageId ? uiT("ui.episode_") : uiT("ui.memory")}
        </Button>
        {confirmDelete && (
          <div className="flex flex-col gap-2">
            <p className="text-xs">
              {uiT(
                "ui.this_memory_and_its_relationships_will_be_deleted_the_original_co",
              )}
            </p>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => void onRemove()}
            >
              {uiT("ui.confirm_deletion")}
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setConfirmDelete(false)}
            >
              {uiT("chat.workspace.cancel")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
