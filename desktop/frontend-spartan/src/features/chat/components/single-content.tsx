/**
 * Sparta Agent – Single Content Component
 *
 * Vista principal de un solo hilo con soporte integrado para panel/overlay
 * de artefactos y panel lateral de ejecución de investigación (Deep Research).
 */

import {
  memo,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Thread } from "@/components/assistant-ui/thread";
import {
  ChatRuntimeProvider,
  useChatActive,
} from "../runtime-provider";
import { useChatRuntimeStore } from "../stores/chat-runtime-store";
import { useChatArtifactsStore } from "../artifacts/store";
import type { ChatArtifact, ChatArtifactSurface } from "../artifacts/types";
import { ArtifactSurface } from "../artifacts/artifact-surface";
import { useResearchRunStore } from "../stores/research-run-store";
import {
  ResearchActivityPanel,
  ResearchActivitySheet,
} from "./research-activity-panel";

const ARTIFACT_PANEL_DEFAULT_SIZE = "38%";
const ARTIFACT_PANEL_TRANSITION_MS = 260;
const ARTIFACT_SURFACE_POP_DELAY_MS = 150;

export const SingleContent = memo(function SingleContent({
  threadId,
  newThreadNonce,
  projectId,
  artifact,
  artifactSurface,
  onCloseArtifact,
}: {
  threadId?: string;
  newThreadNonce?: string;
  projectId?: string | null;
  artifact?: ChatArtifact | null;
  artifactSurface: ChatArtifactSurface;
  onCloseArtifact: () => void;
}): ReactElement {
  const openArtifact = useChatArtifactsStore((state) => state.openArtifact);
  const activeThreadId = useChatRuntimeStore((state) => state.activeThreadId);
  const isMobile = useIsMobile();
  const chatActive = useChatActive();
  const openResearchRunId = useResearchRunStore((state) => state.openRunId);
  const closeResearchPanel = useResearchRunStore((state) => state.closePanel);
  useEffect(() => {
    if (!activeThreadId || !openResearchRunId) return;
    const openRun =
      useResearchRunStore.getState().sessions[openResearchRunId]?.run;
    if (openRun && openRun.threadId !== activeThreadId) closeResearchPanel();
  }, [activeThreadId, openResearchRunId, closeResearchPanel]);
  // A string, not the run: report deltas replace the run ~12x/s, and this owns the thread pane.
  const openResearchThreadId = useResearchRunStore((state) =>
    openResearchRunId
      ? state.sessions[openResearchRunId]?.run.threadId
      : undefined,
  );
  const artifactPanelRef = useRef<PanelImperativeHandle | null>(null);
  const hasInitializedArtifactPanelRef = useRef(false);
  const [isArtifactLayoutAnimating, setIsArtifactLayoutAnimating] =
    useState(false);
  const [isArtifactPanelLayoutActive, setIsArtifactPanelLayoutActive] =
    useState(false);
  const [isArtifactSurfaceVisible, setIsArtifactSurfaceVisible] =
    useState(false);
  const researchMatchesThread = Boolean(
    openResearchThreadId &&
    openResearchThreadId === (threadId ?? activeThreadId),
  );
  const showResearchPanel = researchMatchesThread && !isMobile;
  // Without a URL threadId the artifact must belong to the active thread.
  const showArtifactPanel = !showResearchPanel && Boolean(
    artifact &&
    artifactSurface === "panel" &&
    (threadId
      ? !artifact.threadId || artifact.threadId === threadId
      : Boolean(artifact.threadId && artifact.threadId === activeThreadId)),
  );
  const showContextPanel = showResearchPanel || showArtifactPanel;

  const artifactLayoutActive = showContextPanel || isArtifactPanelLayoutActive;
  const artifactPanelSettledOpen =
    showContextPanel &&
    isArtifactPanelLayoutActive &&
    !isArtifactLayoutAnimating;

  useEffect(() => {
    const panel = artifactPanelRef.current;
    if (!panel) return;

    setIsArtifactSurfaceVisible(false);

    if (!hasInitializedArtifactPanelRef.current) {
      hasInitializedArtifactPanelRef.current = true;
      if (!showContextPanel) {
        panel.resize("0%");
        return;
      }
    }

    setIsArtifactPanelLayoutActive(true);
    setIsArtifactLayoutAnimating(true);
    let resizeFrameId = 0;
    const prepFrameId = window.requestAnimationFrame(() => {
      resizeFrameId = window.requestAnimationFrame(() => {
        panel.resize(showContextPanel ? ARTIFACT_PANEL_DEFAULT_SIZE : "0%");
      });
    });
    const surfaceTimerId = showContextPanel
      ? window.setTimeout(() => {
        setIsArtifactSurfaceVisible(true);
      }, ARTIFACT_SURFACE_POP_DELAY_MS)
      : 0;
    const timeoutId = window.setTimeout(() => {
      setIsArtifactLayoutAnimating(false);
      if (!showContextPanel) {
        setIsArtifactPanelLayoutActive(false);
      }
    }, ARTIFACT_PANEL_TRANSITION_MS + 60);
    return () => {
      window.cancelAnimationFrame(prepFrameId);
      if (resizeFrameId) {
        window.cancelAnimationFrame(resizeFrameId);
      }
      if (surfaceTimerId) {
        window.clearTimeout(surfaceTimerId);
      }
      window.clearTimeout(timeoutId);
    };
  }, [showContextPanel]);

  useEffect(() => {
    if (!researchMatchesThread) return;
    onCloseArtifact();
    useChatRuntimeStore.getState().setSettingsPanelOpen(false);
  }, [researchMatchesThread, onCloseArtifact]);

  const threadPane = (
    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
      <Thread hideWelcome={Boolean(threadId)} targetThreadId={threadId} />
    </div>
  );

  return (
    <ChatRuntimeProvider
      modelType="base"
      initialThreadId={threadId}
      newThreadNonce={newThreadNonce}
      projectId={projectId}
      listThreads={false}
    >
      <ResizablePanelGroup
        orientation="horizontal"
        data-artifact-layout-animating={
          isArtifactLayoutAnimating ? "true" : "false"
        }
        className="chat-artifact-split min-h-0 min-w-0 flex-1 basis-0 overflow-hidden"
      >
        <ResizablePanel
          id="chat-thread"
          defaultSize="100%"
          minSize={artifactLayoutActive ? "42%" : "100%"}
          className="h-full min-h-0 min-w-0 overflow-hidden"
        >
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            {threadPane}
          </div>
        </ResizablePanel>
        <ResizableHandle
          withHandle={false}
          className={cn(
            "relative z-30 -ml-1 -mr-4 w-5 bg-transparent transition-[width,margin] duration-[260ms] ease-[var(--ease-out-cubic)] hover:bg-transparent hover:shadow-none active:bg-transparent active:shadow-none focus-visible:bg-transparent focus-visible:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none",
            !artifactLayoutActive &&
            "pointer-events-none -ml-0 -mr-0 w-0",
          )}
        />
        <ResizablePanel
          panelRef={artifactPanelRef}
          id="chat-artifact"
          defaultSize="0%"
          minSize={
            showResearchPanel
              ? "30%"
              : artifactPanelSettledOpen
                ? "30%"
                : "0%"
          }
          maxSize={
            showResearchPanel
              ? "58%"
              : artifactLayoutActive
                ? "58%"
                : "0%"
          }
          collapsible={showArtifactPanel}
          collapsedSize="0%"
          className={cn(
            "h-full min-h-0 min-w-0 overflow-visible",
            !showContextPanel && "pointer-events-none",
          )}
        >
          <div
            data-artifact-surface-visible={
              isArtifactSurfaceVisible ? "true" : "false"
            }
            className={cn(
              "chat-artifact-pop-surface flex h-full min-h-0 min-w-0 flex-col overflow-visible",
              showResearchPanel && "border-l border-border/70",
            )}
          >
            {showResearchPanel && openResearchRunId ? (
              <ResearchActivityPanel
                key={openResearchRunId}
                runId={openResearchRunId}
                onClose={closeResearchPanel}
              />
            ) : showArtifactPanel && artifact ? (
              <ArtifactSurface
                artifact={artifact}
                variant="panel"
                onClose={onCloseArtifact}
                onOpenFullscreen={() =>
                  openArtifact(artifact, { surface: "overlay" })
                }
              />
            ) : null}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      {openResearchRunId && researchMatchesThread ? (
        <ResearchActivitySheet
          runId={openResearchRunId}
          open={chatActive && isMobile}
          onOpenChange={(open) => {
            if (!open) closeResearchPanel();
          }}
        />
      ) : null}
    </ChatRuntimeProvider>
  );
});
