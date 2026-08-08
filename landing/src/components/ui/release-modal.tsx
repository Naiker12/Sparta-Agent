import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Download, FileText, ShieldCheck, Cpu, ArrowRight } from 'lucide-react';

export function ReleaseModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Show modal if user hasn't dismissed version 0.1.4 announcement
    const hasSeen = localStorage.getItem('sparta_release_v0.1.4_seen');
    if (!hasSeen) {
      const timer = setTimeout(() => setIsOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('sparta_release_v0.1.4_seen', 'true');
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
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900/90 dark:bg-slate-950/90 border border-indigo-500/40 shadow-2xl shadow-indigo-500/20 backdrop-blur-xl text-xs font-semibold text-white hover:border-indigo-500 hover:scale-105 transition-all group cursor-pointer"
        >
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span className="font-mono text-indigo-300">v0.1.5 Disponible</span>
          <Sparkles className="w-3.5 h-3.5 text-pink-400 group-hover:rotate-12 transition-transform" />
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
              className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-slate-950/95 border border-slate-800/80 shadow-2xl shadow-indigo-500/10 p-6 sm:p-8 text-left backdrop-blur-2xl"
            >
              {/* Glow Orbs de Acento */}
              <div className="absolute -top-32 -left-32 w-72 h-72 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-32 -right-32 w-72 h-72 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />

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
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 w-fit">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  <span className="text-[11px] font-bold font-mono tracking-wider text-indigo-300 uppercase">
                    Lanzamiento Oficial v0.1.5
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight leading-tight">
                  Sparta Agent <span className="bg-gradient-to-r from-indigo-400 via-pink-400 to-emerald-400 bg-clip-text text-transparent">v0.1.5</span>
                </h2>

                <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed font-sans">
                  Gran actualización con motor de gráficas v2 (8 tipos y 5 temas visuales), subagentes paralelos delegados, diseño de trazado de búsquedas estilo Claude Code y optimización de permisos de instalación.
                </p>
              </div>

              {/* Feature Items List estilo moderno sin bordes de tarjeta pesados */}
              <div className="relative z-10 flex flex-col gap-2.5 my-6">
                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors group">
                  <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white">Motor de Gráficas V2 &amp; 5 Temas</h4>
                    <p className="text-[11.5px] text-slate-400 truncate">Radar, scatter, barras horizontales y variación de color automática.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors group">
                  <div className="p-2 rounded-xl bg-pink-500/15 text-pink-400 group-hover:scale-105 transition-transform shrink-0">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white">Subagentes Delegados Paralelos</h4>
                    <p className="text-[11.5px] text-slate-400 truncate">Herramientas nativas delegate_research y delegate_code activas.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors group">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white">Búsqueda Web Estilo Claude Code</h4>
                    <p className="text-[11.5px] text-slate-400 truncate">Trazado limpio de fuentes con línea conectora y auto-colapso.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors group">
                  <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 group-hover:scale-105 transition-transform shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white">Instalación Local asInvoker (NSIS)</h4>
                    <p className="text-[11.5px] text-slate-400 truncate">Sin solicitud molesta de permisos de administrador UAC.</p>
                  </div>
                </div>
              </div>

              {/* Botones de Acción Elegantes */}
              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 pt-2">
                <a
                  href="https://github.com/Naiker12/Sparta-Agent/releases/download/v0.1.5/Sparta-Agent-Windows-0.1.5-Setup.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleClose}
                  className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar Sparta v0.1.5 (.exe)
                </a>

                <a
                  href="https://github.com/Naiker12/Sparta-Agent/releases/tag/v0.1.5"
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
