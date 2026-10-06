import { translate as uiTranslate } from "@/i18n";
import { useT as useUiT } from "@/i18n";
import {
  Delete02Icon,
  Edit03Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronLeftIcon, UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";

import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  listKnowledgeBaseDocuments,
  listKnowledgeBases,
  updateKnowledgeBase,
} from "../api/rag-api";
import { useRagAvailabilityStore } from "../api/rag-availability";
import {
  type KnowledgeBase,
  RAG_UPLOAD_ACCEPT,
  isLinkedFolderManaged,
} from "../types/rag";
import { DocumentStatusChip } from "./document-status-chip";
import { LinkedFoldersManager } from "./linked-folders-manager";
import { useRagDocuments } from "./use-rag-documents";

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; kb: KnowledgeBase }
  | { kind: "documents"; kb: KnowledgeBase };

export interface KnowledgeBaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgeBaseDialog({
  open,
  onOpenChange,
}: KnowledgeBaseDialogProps) {
  const uiT = useUiT();

  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>({ kind: "list" });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] =
    useState<KnowledgeBase | null>(null);
  // Measured only: while the answer is unknown this stays false and the dialog renders
  // exactly as it always has. See api/rag-availability.
  const ragUnavailable = useRagAvailabilityStore((s) => s.isUnavailable());
  const ragUnavailableReason = useRagAvailabilityStore((s) =>
    s.unavailableReason(),
  );
  const ragUnavailableHint = ragUnavailable
    ? (ragUnavailableReason ?? undefined)
    : undefined;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setKbs(await listKnowledgeBases());
    } catch (err) {
      toast.error(uiTranslate("ui.failed_to_load_knowledge_bases"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setView({ kind: "list" });
    void refresh();
  }, [open, refresh]);

  function startCreate() {
    setName("");
    setDescription("");
    setView({ kind: "create" });
  }

  function startEdit(kb: KnowledgeBase) {
    setName(kb.name);
    setDescription(kb.description ?? "");
    setView({ kind: "edit", kb });
  }

  function backToList() {
    setView({ kind: "list" });
  }

  async function submitForm() {
    // The button is disabled for this, but the form is also reachable by keyboard and
    // the verdict can land while it is open. A 503 toast is not an explanation.
    if (ragUnavailable) {
      toast.error(uiTranslate("ui.knowledge_bases_are_unavailable_"), {
        description: ragUnavailableReason ?? undefined,
      });
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(uiTranslate("ui.name_is_required"));
      return;
    }
    setSaving(true);
    try {
      if (view.kind === "edit") {
        await updateKnowledgeBase(view.kb.id, {
          name: trimmed,
          description: description.trim(),
        });
        toast.success(uiTranslate("ui.knowledge_base_updated"));
      } else {
        await createKnowledgeBase({
          name: trimmed,
          description: description.trim() || undefined,
        });
        toast.success(uiTranslate("ui.knowledge_base_created"));
      }
      backToList();
      await refresh();
    } catch (err) {
      toast.error(uiTranslate("ui.save_failed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeKb(kb: KnowledgeBase) {
    try {
      await deleteKnowledgeBase(kb.id);
      await refresh();
    } catch (err) {
      toast.error(uiTranslate("ui.delete_failed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const showForm = view.kind === "create" || view.kind === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {view.kind === "documents" ? view.kb.name : uiT("ui.knowledge_bases")}
          </DialogTitle>
          <DialogDescription>
            {view.kind === "documents"
              ? uiT("ui.upload_documents_to_index_for_retrieval_in_chat")
              : uiT("ui.group_documents_into_a_reusable_knowledge_base_for_chat_retrieval")}
          </DialogDescription>
        </DialogHeader>

        {view.kind === "documents" ? (
          <KnowledgeBaseDocuments kb={view.kb} onBack={backToList} />
        ) : showForm ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="kb-name">{uiT("projectsPage.colName")}</Label>
              <Input
                id="kb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={uiT("ui.e_g_product_docs")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kb-description">{uiT("ui.description")}</Label>
              <Textarea
                id="kb-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={uiT("ui.optional_what_this_knowledge_base_contains")}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={backToList} disabled={saving}>
                {uiT("chat.workspace.cancel")}</Button>
              <Button onClick={submitForm} disabled={saving || ragUnavailable}>
                {saving ? <Spinner /> : null}
                {view.kind === "edit" ? uiT("ui.save_changes") : uiT("images.workflows.create.label")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={startCreate}
                disabled={ragUnavailable}
                title={ragUnavailableHint}
              >
                <HugeiconsIcon icon={PlusSignIcon} size={14} />
                {uiT("ui.new_knowledge_base")}</Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : ragUnavailable ? (
              // An empty list on this host is not an empty store, so say which one it is.
              <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {ragUnavailableReason ?? uiT("ui.knowledge_bases_are_unavailable")}
              </div>
            ) : kbs.length === 0 ? (
              <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                {uiT("ui.no_knowledge_bases_yet")}</div>
            ) : (
              <ul className="flex max-h-[60dvh] flex-col divide-y overflow-y-auto rounded-md border">
                {kbs.map((kb) => (
                  <li
                    key={kb.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => setView({ kind: "documents", kb })}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate font-medium">{kb.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {kb.documentCount ?? 0} {" "}{uiT("ui.document")}{(kb.documentCount ?? 0) === 1 ? "" : "s"}
                        {kb.description ? ` · ${kb.description}` : ""}
                      </div>
                    </button>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(kb)}
                        aria-label={uiT("ui.rename_knowledge_base")}
                      >
                        <HugeiconsIcon icon={Edit03Icon} size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmingDelete(kb)}
                        aria-label={uiT("ui.delete_knowledge_base")}
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={14} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
      <AlertDialog
        open={confirmingDelete !== null}
        onOpenChange={(next) => {
          if (!next) {
            setConfirmingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiT("ui.delete_knowledge_base")}</AlertDialogTitle>
            <AlertDialogDescription>
              {uiT("chat.menu.delete")}{" "}
              <span className="font-medium text-foreground">
                &quot;{confirmingDelete?.name}&quot;
              </span>{" "}
              {uiT("ui.and_all_its_documents_this_cannot_be_undone")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{uiT("chat.workspace.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const kb = confirmingDelete;
                setConfirmingDelete(null);
                if (kb) {
                  void removeKb(kb);
                }
              }}
            >
              {uiT("chat.menu.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function KnowledgeBaseDocuments({
  kb,
  onBack,
}: {
  kb: KnowledgeBase;
  onBack: () => void;
}) {
  const uiT = useUiT();

  const lister = useCallback(() => listKnowledgeBaseDocuments(kb.id), [kb.id]);
  const { documents, loading, uploading, refresh, upload, remove } =
    useRagDocuments({ type: "kb", kbId: kb.id }, lister);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleLinkedSourcesChanged = useCallback(() => {
    void refresh({ quiet: true });
  }, [refresh]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeftIcon className="size-4" />
          {uiT("ui.all_knowledge_bases")}</Button>
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Spinner /> : <UploadIcon className="size-3.5" />}
          {uiT("studio.datasetPicker.sourceUpload")}</Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple={true}
          accept={RAG_UPLOAD_ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              void upload(e.target.files);
            }
            e.target.value = "";
          }}
        />
      </div>
      {loading && documents.length === 0 ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
          {uiT("ui.no_documents_yet_upload_a_pdf_markdown_docx_html_or_text_file")}</div>
      ) : (
        <div className="flex max-h-[55dvh] flex-wrap gap-1.5 overflow-y-auto pr-0.5">
          {documents.map((doc) => (
            <DocumentStatusChip
              key={doc.id}
              filename={doc.filename}
              status={doc.status}
              progress={doc.progress}
              error={doc.error}
              onRemove={
                doc.id.startsWith("pending_") || isLinkedFolderManaged(doc)
                  ? undefined
                  : () => void remove(doc.id)
              }
            />
          ))}
        </div>
      )}
      <div className="border-t pt-3">
        <LinkedFoldersManager
          scope={{ type: "knowledge_base", id: kb.id }}
          compact={true}
          onSourcesChanged={handleLinkedSourcesChanged}
        />
      </div>
    </div>
  );
}
