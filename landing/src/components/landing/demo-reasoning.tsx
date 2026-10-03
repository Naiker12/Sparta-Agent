import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';
import { BulbIcon } from '../../../../desktop/frontend-spartan/src/lib/bulb-icon';
import { resolveReasoningOpen, resolveReasoningToggle } from '../../../../desktop/frontend-spartan/src/features/chat/utils/reasoning-visibility';
import { DesktopStreamingMessage } from './desktop-streaming-message';

/** The desktop's opening rules and glyph, adapted without its conversation store. */
export function DemoReasoning({ active, pending, text, messageId, collapseByDefault }: {
  active: boolean; pending: boolean; text: string; messageId: string; collapseByDefault: boolean;
}) {
  const id = useId();
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [characters, setCharacters] = useState(0);
  const [duration, setDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const elapsed = useRef(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      setCharacters(value => Math.min(text.length, value + 8));
      setDuration(Math.max(1, Math.round((elapsed.current + performance.now() - start) / 1000)));
    }, 90);
    return () => { elapsed.current += performance.now() - start; window.clearInterval(timer); };
  }, [active, messageId, text]);
  const open = resolveReasoningOpen({ isStreaming: active, collapseByDefault,
    dismissedWhileStreaming: dismissed, manualOpen });
  return <div className="demo-reasoning-block aui-reasoning-root" data-slot="reasoning-root"
    data-variant={open ? 'outline' : 'ghost'}>
    <div className="demo-reasoning-header"><button type="button" className="aui-reasoning-trigger" data-slot="reasoning-trigger"
      aria-expanded={open} aria-controls={id} onClick={() => {
        const next = resolveReasoningToggle(!open, { isStreaming: active, collapseByDefault });
        setManualOpen(next.manualOpen);
        if (next.dismissedWhileStreaming !== undefined) setDismissed(next.dismissedWhileStreaming);
      }}>
      <BulbIcon />
      <span>{active ? 'Pensando' : pending ? 'Pensamiento en pausa' : duration > 0 ? `Pensó durante ${duration} ${duration === 1 ? 'segundo' : 'segundos'}` : 'Razonamiento'}</span>
      {active && <span className="demo-thinking-dots" aria-hidden="true"><i /><i /><i /></span>}
      <ChevronDown className="demo-reasoning-chevron" />
    </button>
    {open && !pending && <button className="demo-reasoning-copy" type="button" title={copied ? 'Copiado' : 'Copiar razonamiento'} aria-label={copied ? 'Razonamiento copiado' : 'Copiar razonamiento'} onClick={async () => {
      try { await navigator.clipboard.writeText(pending ? text.slice(0, characters) : text); setCopied(true); } catch { setCopied(false); }
    }}>{copied ? <Check /> : <Copy />}</button>}
    </div>
    <div id={id} hidden={!open} data-slot="reasoning-content" aria-busy={active}>
      <DesktopStreamingMessage text={pending ? text.slice(0, characters) : text}
        running={active} messageId={`${messageId}:reasoning`} />
    </div>
  </div>;
}
