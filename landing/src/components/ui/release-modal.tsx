import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Download, FileText, ShieldCheck, Cpu, ArrowRight } from 'lucide-react';

export function ReleaseModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Show the announcement once for this specific release.
    const hasSeen = localStorage.getItem('sparta_release_v0.1.7_seen');
    if (!hasSeen) {
      const timer = setTimeout(() => setIsOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('sparta_release_v0.1.7_seen', 'true');
    setIsOpen(false);
  };

  const handleReopen = () => {
    setIsOpen(true);
  };

  return (
    <>
      {/* Floating Announcement Trigger Button when modal is closed */}
      {!isOpen && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleReopen}
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900/90 dark:bg-slate-950/90 border border-zinc-500/40 shadow-2xl shadow-zinc-500/20 backdrop-blur-xl text-xs font-semibold text-white hover:border-zinc-500 hover:scale-105 transition-all group cursor-pointer"
        >
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-500"></span>
          </span>
          <span className="font-mono text-zinc-300">v0.1.7 disponible</span>
          <Sparkles className="w-3.5 h-3.5 text-zinc-300 group-hover:rotate-12 transition-transform" />
        </motion.button>
      )}

      {/* Main Release Announcement Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-slate-950/95 border border-slate-800/80 shadow-2xl shadow-zinc-500/10 p-6 sm:p-8 text-left backdrop-blur-2xl"
            >
              {/* Glow Orbs de Acento */}
              <div className="absolute -top-32 -left-32 w-72 h-72 bg-zinc-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-32 -right-32 w-72 h-72 bg-zinc-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Botón Cerrar Minimalista */}
              <button
                onClick={handleClose}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors z-20 cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Release Header */}
              <div className="relative z-10 flex flex-col gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-500/10 border border-zinc-500/20 w-fit">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                  <span className="text-[11px] font-bold font-mono tracking-wider text-zinc-300 uppercase">
                    Lanzamiento oficial v0.1.7
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight leading-tight">
                  Sparta Agent <span className="text-zinc-300">v0.1.7</span>
                </h2>

                <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed font-sans">
                  Gran actualización con selector de modelos ultra-estilizado, logotipos vectoriales dinámicos, control segmentado Chat/Terminal, notificaciones toast en píldora y grafo de memoria temático mejorado.
                </p>
              </div>

              {/* Feature Items List */}
              <div className="relative z-10 flex flex-col gap-2.5 my-6">
                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors group">
                  <div className="p-2 rounded-xl bg-zinc-500/15 text-zinc-400 group-hover:scale-105 transition-transform shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white">Selector de Modelos Delgado &amp; Vectores SVG</h4>
                    <p className="text-[11.5px] text-slate-400 truncate">Menú de 215px con logotipos nativos de OpenAI, DeepSeek, Grok, Anthropic y OpenRouter.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors group">
                  <div className="p-2 rounded-xl bg-zinc-500/15 text-zinc-300 group-hover:scale-105 transition-transform shrink-0">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white">Barra Superior Segmentada Chat / Terminal</h4>
                    <p className="text-[11.5px] text-slate-400 truncate">Control segmentado tipo píldora con iconos nativos y estado activo sutil.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors group">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white">Notificaciones Toast &amp; Salida de Herramientas</h4>
                    <p className="text-[11.5px] text-slate-400 truncate">Toast en píldora flotante cristalina y bloques de herramientas sutiles sin cajas blancas.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors group">
                  <div className="p-2 rounded-xl bg-zinc-500/15 text-zinc-300 group-hover:scale-105 transition-transform shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white">Grafo de Memoria Temático D3 &amp; Terminal Nítida</h4>
                    <p className="text-[11.5px] text-slate-400 truncate">Separación de nodos por temática, rejilla cósmica y formato EOL de terminal nítido.</p>
                  </div>
                </div>
              </div>

              {/* Botones de Acción Elegantes */}
              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 pt-2">
                <a
                  href="https://github.com/Naiker12/Sparta-Agent/releases/download/v0.1.7/Sparta-Agent-Windows-0.1.7-Setup.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleClose}
                  className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold shadow-lg shadow-black/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar Sparta v0.1.7 (.exe)
                </a>

                <a
                  href="https://github.com/Naiker12/Sparta-Agent/releases/tag/v0.1.7"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Ver Release Notes
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
