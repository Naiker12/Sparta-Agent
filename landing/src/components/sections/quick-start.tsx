import { useState } from 'react';
import { SectionHeader } from '../ui/section-header';
import { Terminal, Copy, Check, ArrowRight } from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';
import { motion } from 'framer-motion';

export function QuickStart() {
  const [copied, setCopied] = useState(false);

  const commandText = `# 1. Clonar e instalar dependencias del monorepo
git clone https://github.com/Naiker12/Sparta-Agent.git
cd Sparta-Agent
pnpm install

# 2. Iniciar el IDE en modo desarrollo
pnpm dev`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(commandText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="quick-start" className="py-12 relative overflow-hidden max-w-full bg-white/85 dark:bg-[#09090b]/85 backdrop-blur-md text-slate-900 dark:text-white border-y border-slate-200 dark:border-white/10 font-sans transition-colors duration-300">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] max-w-[100vw] h-[250px] bg-[#18181b]/10 blur-[130px] pointer-events-none" />

      {/* UNIFIED CONTINUOUS GRID CONTAINER MAX-W-7XL BORDER-X */}
      <div className="mx-auto max-w-7xl border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <SectionHeader
          eyebrow="QUICK START // DESARROLLADORES"
          title="Mira al agente planificar y ejecutar su primera tarea en tu propia máquina."
          description="Sparta Agent es de código abierto. Sin suscripciones forzadas, sin filtración de datos y con control total sobre tus modelos de lenguaje."
        />

        {/* COMPACT & SLEEK TERMINAL BOX (ORION STYLE) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-[#09090b] border border-slate-200 dark:border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg dark:shadow-2xl relative max-w-4xl mx-auto mt-8"
        >
          {/* Terminal Header Bar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-white/10">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <Terminal className="w-3.5 h-3.5 text-[#52525b]" />
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">bash — local setup guide</span>
            </div>

            <button
              onClick={copyToClipboard}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-[#18181b]/20 border border-[#18181b]/40 text-[#52525b] hover:bg-[#18181b] hover:text-white transition-all text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#18181b]/20"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar comandos'}</span>
            </button>
          </div>

          {/* Terminal Code Block */}
          <pre className="font-mono text-xs text-zinc-600 dark:text-zinc-300 overflow-x-auto p-4 rounded-xl bg-slate-50 dark:bg-[#111113] leading-relaxed border border-slate-200 dark:border-white/10 shadow-inner">
            <code>{commandText}</code>
          </pre>

          {/* Requirements & Action Buttons Bar */}
          <div className="mt-4 flex flex-col items-start gap-3 border-t border-slate-200 pt-3 font-mono text-xs text-slate-500 dark:border-white/10 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px]">Requisitos: <strong className="text-slate-900 dark:text-white">Node.js 18+ · pnpm 10+</strong></span>
            
            <a
              href="https://github.com/Naiker12/Sparta-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#18181b] bg-[#18181b] px-5 py-2 font-mono text-xs font-bold text-white shadow-lg shadow-[#18181b]/40 transition-all cursor-pointer hover:bg-[#27272a] sm:w-auto"
            >
              <GithubIcon className="w-4 h-4 text-white" />
              <span>Ver y Clonar en GitHub</span>
              <ArrowRight className="w-3.5 h-3.5 text-white/80" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
