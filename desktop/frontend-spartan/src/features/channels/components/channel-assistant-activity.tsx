import { useEffect, useState } from "react";
import { useWorkOverview } from "@/features/work";
import { useUserProfileStore } from "@/features/profile";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useChannelAssistantStore } from "../stores/channel-assistant-store";
import "./channel-assistant.css";

function Activity() {
  const t = useT();
  const { runs, error } = useWorkOverview(0, 2_000);
  const name = useUserProfileStore(
    (state) => state.nickname || state.displayName,
  );
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 2_000);
    return () => clearInterval(timer);
  }, []);
  const [minimized, setMinimized] = useState(false);
  const active = runs.filter(
    (run) => run.source_kind === "telegram" && run.status === "running",
  );
  const finished = runs.find(
    (run) =>
      run.source_kind === "telegram" &&
      ["completed", "cancelled", "failed", "needs_review"].includes(
        run.status,
      ) &&
      run.updated_at >= mountedAt &&
      now - run.updated_at < 8_000,
  );
  if (error || (!active.length && !finished)) return null;
  return (
    <div className="channel-assistant-layer" data-expanded={!minimized}>
      <div className="channel-assistant-backdrop" aria-hidden="true" />
      <aside
        className="channel-assistant"
        aria-label={t("channels.assistant.title")}
      >
        <div className="channel-assistant-content">
          <div className="flex flex-col items-center gap-1">
            <p className="max-w-full truncate font-medium">
              {name || "Spartan"}
            </p>
            <p className="text-xs text-muted-foreground">
              Telegram{active.length > 0 ? ` · ${active.length}` : ""}
            </p>
          </div>
          {!minimized && (
            <div className="flex flex-col items-center gap-1">
              <div
                className="channel-assistant-orb"
                data-active={active.length > 0}
                aria-hidden="true"
              >
                <svg viewBox="0 0 120 120" className="channel-assistant-orbit">
                  <circle
                    cx="60"
                    cy="60"
                    r="44"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    opacity=".2"
                  />
                  <path
                    d="M60 16 A44 44 0 0 1 104 60"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="104" cy="60" r="3" fill="currentColor" />
                </svg>
                <span className="channel-assistant-core" />
              </div>
              <div role="status" className="flex items-center gap-2 text-sm">
                {active.length > 0 && <Spinner />}
                {t(
                  !active.length
                    ? finished?.status === "completed"
                      ? "channels.assistant.completed"
                      : finished?.status === "cancelled"
                        ? "channels.assistant.cancelled"
                        : "channels.assistant.failed"
                    : active[0]?.request.activityStage === "updating_profile"
                      ? "channels.assistant.updatingProfile"
                      : active[0]?.request.activityStage === "searching_web"
                        ? "channels.assistant.searchingWeb"
                        : active[0]?.request.activityStage === "reading_page"
                          ? "channels.assistant.readingPage"
                          : active[0]?.request.activityStage === "transcribing"
                            ? "channels.assistant.transcribing"
                            : active[0]?.request.activityStage ===
                                "reading_document"
                              ? "channels.assistant.readingDocument"
                              : active[0]?.request.activityStage ===
                                  "responding"
                                ? "channels.assistant.responding"
                                : "channels.assistant.working",
                )}
              </div>
            </div>
          )}
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMinimized(!minimized)}
            >
              {t(
                minimized
                  ? "channels.assistant.expand"
                  : "channels.assistant.minimize",
              )}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
export function ChannelAssistantActivity() {
  const enabled = useChannelAssistantStore((state) => state.enabled);
  return enabled ? <Activity /> : null;
}
