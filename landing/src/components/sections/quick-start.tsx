import { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Terminal, Copy, Check, ArrowRight } from 'lucide-react';

export function QuickStart() {
  const [copied, setCopied] = useState(false);

  const commandText = `# 1. Clonar e instalar dependencias y el entorno Python sidecar
git clone https://github.com/Naiker12/Sparta-Agent.git
cd Sparta-Agent
pnpm install && pnpm sidecar:setup

# 2. Compilar el broker de seguridad nativo en Rust
pnpm rust:napi

# 3. Iniciar el IDE en modo desarrollo
pnpm dev`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(commandText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="quick-start" className="py-20 md:py-28 relative bg-[var(--bg-surface)] border-y border-[var(--border-normal)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <Badge variant="accent" className="px-3.5 py-1 text-xs uppercase font-mono tracking-wider">
            Quick Start
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-[var(--text-display)]">
            Inicia Sparta Agent en 3 Comandos
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-secondary)]">
            Sin configuraciones complejas. Clona el repositorio, instala el entorno y lanza la app en minutos.
          </p>
        </div>

        <Card className="max-w-3xl mx-auto border-[var(--border-strong)] bg-[#0C0C10] p-6 md:p-8 shadow-2xl relative">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-mono text-zinc-400 font-medium">bash — local setup</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="gap-2 text-xs font-mono font-semibold bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar comandos'}</span>
            </Button>
          </div>

          <pre className="font-mono text-xs md:text-sm text-indigo-200 overflow-x-auto p-5 rounded-xl bg-[#070709] leading-relaxed border border-zinc-800 shadow-inner">
            <code>{commandText}</code>
          </pre>

          <div className="mt-6 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between text-xs text-zinc-400 font-mono gap-3">
            <span>Requisitos: Node.js 18+ · pnpm 10+ · Python 3.11+ · Rust toolchain</span>
            <a
              href="https://github.com/Naiker12/Sparta-Agent#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 font-semibold underline-offset-4 hover:underline flex items-center gap-1"
            >
              Ver guía de instalación <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </Card>
      </div>
    </section>
  );
}
