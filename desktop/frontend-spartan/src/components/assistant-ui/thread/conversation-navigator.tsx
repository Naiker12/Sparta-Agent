import { useEffect, useMemo, useState } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function ConversationNavigator({viewport, onNavigate, bottom = 180}: {
  viewport: HTMLElement | null;
  onNavigate: () => void;
  bottom?: number;
}) {
  const aui = useAui();
  const t = useT();
  // Content streams constantly; only rebuild the rail when its message identities change.
  const identity = useAuiState(({thread}) => JSON.stringify(thread.messages
    .filter(message => message.role === "user" || message.role === "assistant")
    .map(message => ({id: message.id, role: message.role}))));
  const marks = useMemo(() => JSON.parse(identity) as {id: string; role: "user" | "assistant"}[], [identity]);
  const [active, setActive] = useState<string>();
  const [focused, setFocused] = useState<string>();
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!viewport) return;
    setActive(undefined);
    setFocused(undefined);
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.chatMessageId!;
        if (entry.isIntersecting) visible.set(id, entry.boundingClientRect.top);
        else visible.delete(id);
      }
      // Observer entries arrive incrementally; cached coordinates become stale
      // during scrolling. Conversation order remains authoritative.
      const first = marks.find(mark => visible.has(mark.id));
      if (first) setActive(first.id);
    }, {root: viewport, rootMargin: "-5% 0px -65% 0px", threshold: 0});
    viewport.querySelectorAll("[data-chat-message-id]").forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [viewport, identity]);

  if (marks.length < 2) return null;
  const previewFor = (id: string) => {
    const message = aui.thread().getState().messages.find(message => message.id === id);
    setPreview(message?.content.filter(part => part.type === "text").map(part => part.text).join(" ").replace(/\s+/g, " ").slice(0, 220) || t("chat.navigator.nonText"));
  };
  const jump = (id: string) => {
    const target = Array.from(viewport?.querySelectorAll<HTMLElement>("[data-chat-message-id]") ?? []).find(node => node.dataset.chatMessageId === id);
    if (!target) return;
    onNavigate();
    const top = viewport!.scrollTop + target.getBoundingClientRect().top - viewport!.getBoundingClientRect().top - 12;
    viewport!.scrollTo({top: Math.max(0, top), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
    setActive(id);
  };
  return <nav aria-label={t("chat.navigator.title")} data-testid="conversation-navigator"
    className="absolute left-0 top-[calc(var(--studio-content-top-inset,0px)+80px)] flex w-5 flex-col items-center justify-center py-2"
    style={{bottom, gap: 0}}>
    {marks.map((mark, index) => {
      const label = t("chat.navigator.message", {index: index + 1, role: t(mark.role === "user" ? "chat.navigator.you" : "chat.navigator.assistant")});
      return <HoverCard key={mark.id} openDelay={150} closeDelay={80}>
        <HoverCardTrigger asChild><button type="button"
          aria-label={label} aria-current={active === mark.id ? "location" : undefined}
          tabIndex={(focused ?? active ?? marks[0].id) === mark.id ? 0 : -1}
          data-message-target={mark.id}
          onMouseEnter={() => previewFor(mark.id)}
          onFocus={() => {setFocused(mark.id); previewFor(mark.id);}}
          onClick={() => jump(mark.id)}
          onKeyDown={event => {
            const next = event.key === "ArrowDown" ? Math.min(marks.length - 1, index + 1)
              : event.key === "ArrowUp" ? Math.max(0, index - 1)
              : event.key === "Home" ? 0 : event.key === "End" ? marks.length - 1 : null;
            if (next === null) return;
            event.preventDefault();
            const buttons = event.currentTarget.closest("nav")!.querySelectorAll<HTMLButtonElement>("button[data-message-target]");
            buttons[next]?.focus();
          }}
          className="group flex min-h-0 max-h-2.5 w-5 flex-1 items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ><span className={cn("h-0.5 rounded-full transition-colors", mark.role === "user" ? "w-2.5" : "w-1.5", active === mark.id ? "bg-primary" : "bg-muted-foreground/40 group-hover:bg-foreground")} /></button></HoverCardTrigger>
        <HoverCardContent side="right" align="center" className="max-w-[calc(100vw-3rem)]">
          <p className="mb-1 text-xs text-muted-foreground">{label}</p>
          <p className="line-clamp-4 break-words">{preview}</p>
        </HoverCardContent>
      </HoverCard>;
    })}
  </nav>;
}
