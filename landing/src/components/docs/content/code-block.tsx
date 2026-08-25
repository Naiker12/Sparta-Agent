import { Check, TerminalSquare } from 'lucide-react';
import { useState } from 'react';

interface CodeBlockProps {
  command?: string;
  title?: string;
}

export function CodeBlock({
  command = 'git clone https://github.com/Naiker12/Sparta-Agent.git\ncd Sparta-Agent\npnpm install\npnpm dev',
  title = 'terminal',
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const lines = command.split('\n');

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <TerminalSquare className="size-3.5" /> {title}
        </div>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : null}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-7 text-zinc-100">
        <code>
          {lines.map((line, idx) => (
            <span key={idx}>
              <span className="text-zinc-500">$ </span>
              {line}
              {idx < lines.length - 1 ? '\n' : ''}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
