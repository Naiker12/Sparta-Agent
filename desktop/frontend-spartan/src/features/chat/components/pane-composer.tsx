import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { ComposerPrimitive, useAui, useAuiState } from "@assistant-ui/react";
import { ArrowUpIcon, ChevronDownIcon, GlobeIcon, MicIcon, PlusIcon, ShieldCheckIcon, SquareIcon } from "lucide-react";
import { ComposerAttachments } from "@/components/assistant-ui/attachment";
import { ChatDictationBar } from "@/components/assistant-ui/chat-dictation-bar";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { ApiProviderModelSelector } from "./api-provider-model-selector";
import { ThreadWorkspaceChip } from "./thread-workspace-chip";
import type { ChatPane } from "../stores/chat-panels-store";
import type { QueuedChatRunSettings } from "../utils/queued-chat-run-settings";
import { composerDraftKey, readComposerDraft, writeComposerDraft } from "../utils/composer-draft";
import { updateStoredChatThread } from "../utils/chat-history-storage";
import { isChatThreadDeleted } from "../utils/chat-thread-tombstones";

/** Same composer primitives and surface as the main chat, with pane-owned settings. */
export function PaneComposer({ pane, settings }: { pane: ChatPane; settings: MutableRefObject<QueuedChatRunSettings> }) {
  const aui = useAui();
  const running = useAuiState(({thread}) => thread.isRunning);
  const loading = useAuiState(({thread}) => thread.isLoading);
  const owner = useAuiState(({threadListItem}) => threadListItem.remoteId);
  const text = useAuiState(({composer}) => composer.text);
  const attachments = useAuiState(({composer}) => composer.attachments);
  const dictating = useAuiState(({composer}) => composer.dictation != null);
  const [config, setConfig] = useState(() => structuredClone(settings.current));
  const [changing, setChanging] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const sendLock = useRef(false);
  const t = useT();
  const key = composerDraftKey(pane.thread.id);
  useEffect(() => {
    if (owner !== pane.thread.id) return;
    aui.composer().setText(readComposerDraft(key) ?? "");
    setReady(true);
  }, [owner, pane.thread.id, key, aui]);
  useEffect(() => {
    if (ready && owner === pane.thread.id && !sendLock.current) writeComposerDraft(key, text);
  }, [ready, owner, key, text, pane.thread.id]);
  const persist = async (patch: Partial<QueuedChatRunSettings>, modelId?: string) => {
    if (running || changing) return;
    setChanging(true); setError("");
    const next = { ...settings.current, ...patch };
    if (modelId) next.params = {...next.params, checkpoint: modelId};
    try {
      await updateStoredChatThread(pane.thread.id, {
        ...(modelId ? {modelId} : {}),
        settings: {...pane.thread.settings, permissionMode: next.permissionMode === "full" ? "ask" : next.permissionMode, toolsEnabled: next.toolsEnabled, codeToolsEnabled: next.codeToolsEnabled, imageToolsEnabled: next.imageToolsEnabled, reasoningEnabled: next.reasoningEnabled},
      });
      settings.current = next; setConfig(structuredClone(next));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("chat.panels.failed")); }
    finally { setChanging(false); }
  };
  const pendingAttachments = attachments.some(item => item.status.type !== "complete");
  const blocked = loading || !ready || changing || pendingAttachments || !config.params.checkpoint;
  const send = () => {
    if (blocked || running || sendLock.current) return;
    const state = aui.composer().getState();
    if (!state.text.trim() && !state.attachments.length) return;
    if (aui.threadListItem().getState().remoteId !== pane.thread.id || isChatThreadDeleted(pane.thread.id)) { setError(t("chat.panels.unavailable")); return; }
    sendLock.current = true; setError("");
    try { aui.composer().send(); writeComposerDraft(key, ""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("chat.panels.failed")); }
    finally { sendLock.current = false; }
  };
  const permission = config.permissionMode === "full" ? "ask" : config.permissionMode;
  return <div className="relative mx-auto w-full min-w-0 max-w-[48rem]" data-pane-composer>
    {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col" onSubmit={event => {event.preventDefault(); send();}}>
      <ThreadWorkspaceChip threadId={pane.thread.id} isRunning={running} />
      <ComposerPrimitive.AttachmentDropzone className="spartan-composer-surface aui-composer-attachment-dropzone relative z-10">
        <ComposerAttachments />
        <div className="spartan-composer-line" data-dictating={dictating || undefined}>
          <div className="spartan-composer-left" data-pill-compact="true">
            <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="spartan-composer-plus" aria-label={t("chat.panels.tools")} disabled={blocked || running}><PlusIcon className="size-[18px]" /></button></DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start"><DropdownMenuGroup>
                <ComposerPrimitive.AddAttachment asChild><DropdownMenuItem>{t("chat.panels.attach")}</DropdownMenuItem></ComposerPrimitive.AddAttachment>
                <DropdownMenuCheckboxItem checked={config.codeToolsEnabled} onCheckedChange={value => void persist({codeToolsEnabled: value})}>{t("chat.panels.code")}</DropdownMenuCheckboxItem>
              </DropdownMenuGroup></DropdownMenuContent>
            </DropdownMenu>
            {!dictating && <>
              <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="sm" variant="ghost" className="rounded-full px-2" disabled={changing || running} aria-label={t("chat.panels.permissions")}><ShieldCheckIcon data-icon="inline-start" /><span className="pane-control-label">{t(`chat.composer.permissions.${permission}.label`)}</span><ChevronDownIcon data-icon="inline-end" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent side="top"><DropdownMenuRadioGroup value={permission} onValueChange={value => void persist({permissionMode: value as "ask" | "auto" | "off", bypassPermissions: false, confirmToolCalls: value === "ask"})}>
                  {(["ask", "auto", "off"] as const).map(mode => <DropdownMenuRadioItem key={mode} value={mode}>{t(`chat.composer.permissions.${mode}.label`)}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup></DropdownMenuContent>
              </DropdownMenu>
              <Button type="button" size="sm" variant="ghost" className={cn("rounded-full px-2", config.toolsEnabled && "text-primary")} aria-label={t("chat.panels.search")} aria-pressed={config.toolsEnabled} disabled={changing || running} onClick={() => void persist({toolsEnabled: !config.toolsEnabled})}><GlobeIcon data-icon="inline-start" /><span className="pane-control-label">{t("chat.panels.search")}</span></Button>
            </>}
          </div>
          {dictating ? <ChatDictationBar onSend={send} sendDisabled={blocked || running} /> : <>
            <ComposerPrimitive.Input className="aui-composer-input spartan-composer-input" placeholder={t("chat.composer.askAnything")} aria-label={t("chat.panels.message")} minRows={1} maxRows={12} disabled={!ready || loading} autoFocus={false} onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
            }} />
            <div className="aui-composer-action-wrapper flex shrink-0 items-center gap-1">
              <fieldset disabled={changing || running} className="min-w-0"><ApiProviderModelSelector models={[]} value={config.params.checkpoint} onValueChange={id => void persist({}, id)} className="max-w-[130px]" /></fieldset>
              {config.supportsReasoning && <Button type="button" variant="ghost" size="sm" disabled={changing || running} aria-label={t("chat.panels.reasoning")} aria-pressed={config.reasoningEnabled} onClick={() => void persist({reasoningEnabled: !config.reasoningEnabled})}>{t("chat.panels.reasoning")}</Button>}
              <TooltipIconButton type="button" tooltip={t("chat.composer.dictate")} aria-label={t("chat.composer.dictate")} variant="ghost" className="size-7.5 rounded-full" onClick={() => {try {aui.composer().startDictation();} catch (cause) {setError(cause instanceof Error ? cause.message : t("chat.panels.failed"));}}}><MicIcon className="size-[17px]" /></TooltipIconButton>
              {running ? <TooltipIconButton type="button" tooltip={t("chat.panels.stop")} aria-label={t("chat.panels.stop")} className="aui-composer-cancel size-7.5 rounded-full" onClick={() => aui.thread().cancelRun()}><SquareIcon className="size-3 fill-current" /></TooltipIconButton> : <TooltipIconButton type="button" tooltip={t("chat.panels.send")} aria-label={t("chat.panels.send")} className="aui-composer-send size-7.5 rounded-full" disabled={blocked || (!text.trim() && !attachments.length)} onClick={send}><ArrowUpIcon className="spartan-send-icon size-4" /></TooltipIconButton>}
            </div>
          </>}
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  </div>;
}
