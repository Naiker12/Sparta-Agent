import { motion } from 'framer-motion';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

const headline = [
  { text: 'Trabaja con un agente IA que', className: 'text-slate-900 dark:text-white' },
  { text: 'gestiona tus operaciones', className: 'bg-gradient-to-r from-[#f66e60] via-[#b36b73] to-[#3b82f6] bg-clip-text text-transparent' },
  { text: 'diarias.', className: 'text-slate-900 dark:text-white' },
];

function TypewriterHeadline() {
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const fullText = headline.map((line) => line.text).join(' ');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisibleCharacters((current) => {
        if (current >= fullText.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 42);
    return () => window.clearInterval(timer);
  }, [fullText.length]);

  let consumed = 0;
  return (
    <h1 aria-label={fullText} className="max-w-4xl text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-6xl lg:text-7xl">
      {headline.map((line, index) => {
        const start = consumed;
        const text = visibleCharacters > start ? line.text.slice(0, visibleCharacters - start) : '';
        consumed += line.text.length + 1;
        const showCursor = (visibleCharacters >= start && visibleCharacters < consumed) || (index === headline.length - 1 && visibleCharacters >= fullText.length);
        return <span key={line.text} className={`block ${line.className}`}>{text}{showCursor ? <motion.span aria-hidden="true" animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} className="ml-1 inline-block h-[0.82em] w-[0.08em] align-[-0.08em] bg-current" /> : null}</span>;
      })}
    </h1>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-transparent pb-20 pt-12 font-sans md:pb-28 md:pt-20">
      <div className="mx-auto max-w-7xl border-x border-slate-200 px-4 dark:border-white/10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8 py-8 text-center sm:py-16">
          <TypewriterHeadline />
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.16 }} className="max-w-3xl text-base font-medium leading-relaxed text-slate-600 sm:text-xl dark:text-gray-300">
            Automatiza tareas repetitivas en Notion, OneDrive, Google Drive, Gmail y tu filesystem local desde una aplicación de escritorio.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.24 }} className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <a href="#mcp" className="group inline-flex h-12 items-center gap-2 rounded-xl border border-blue-400/30 bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] px-7 text-base font-semibold text-white shadow-lg shadow-blue-950/40 transition duration-300 hover:-translate-y-0.5 hover:from-[#2563eb] hover:to-[#3b82f6] hover:shadow-blue-500/30"><span>Explorar conectores MCP</span><ArrowUpRight className="size-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></a>
            <a href="#seguridad" className="group inline-flex h-12 items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-7 text-base font-semibold text-emerald-100 shadow-lg shadow-emerald-950/20 transition duration-300 hover:-translate-y-0.5 hover:bg-emerald-500/20 hover:shadow-emerald-500/15"><ShieldCheck className="size-5 text-emerald-400 transition-transform duration-300 group-hover:scale-110" /><span>Ver seguridad y Vault</span><ArrowUpRight className="size-4 text-emerald-300 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
