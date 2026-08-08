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
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900/90 dark:bg-slate-950/90 border border-[#663af3]/40 shadow-2xl shadow-[#663af3]/20 backdrop-blur-xl text-xs font-semibold text-white hover:border-[#663af3] hover:scale-105 transition-all group cursor-pointer"
        >
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ec4899] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#663af3]"></span>
          </span>
          <span className="font-mono text-[#a78bfa]">v0.1.4 Lanzado</span>
          <Sparkles className="w-3.5 h-3.5 text-[#ec4899] group-hover:rotate-12 transition-transform" />
        </motion.button>
      )}

      {/* Main Release Announcement Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl shadow-[#663af3]/30 p-6 sm:p-8 text-left"
            >
              {/* Top Cyber Glow Orbs */}
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#663af3]/25 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#ec4899]/20 rounded-full blur-3xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors z-20 cursor-pointer"
                title="Cerrar anuncio"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Release Header */}
              <div className="relative z-10 flex flex-col gap-3">
                <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#663af3]/15 border border-[#663af3]/30 w-fit">
                  <Sparkles className="w-3.5 h-3.5 text-[#ec4899]" />
                  <span className="text-xs font-bold font-mono tracking-wide text-[#a78bfa] uppercase">
                    ✨ LANZAMIENTO OFICIAL v0.1.4
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight leading-tight">
                  Sparta Agent <span className="bg-gradient-to-r from-[#a78bfa] via-[#ec4899] to-[#34d399] bg-clip-text text-transparent">v0.1.4</span> Ya Disponible
                </h2>

                <p className="text-sm text-slate-300 leading-relaxed font-sans">
                  Hemos publicado la nueva versión con lector nativo de documentos asíncronos (PDF, Word, Excel, PowerPoint), vista previa modal de adjuntos, auto-actualizador y correcciones de seguridad.
                </p>
              </div>

              {/* Release Highlights Grid */}
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-6">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#663af3]/20 text-[#a78bfa] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">Lector Nativo &amp; Asíncrono</h4>
                    <p className="text-[11.5px] text-slate-400 leading-normal">
                      Procesamiento de PDF, Office y EPUB sin bloquear la interfaz.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#ec4899]/20 text-[#ec4899] shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">Vista Previa Modal &amp; Tarjetas</h4>
                    <p className="text-[11.5px] text-slate-400 leading-normal">
                      Inspección cómoda de archivos en tarjetas interactivas sin saturar el chat.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#10b981]/20 text-[#10b981] shrink-0">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">Engine FlateDecode &amp; Telemetría</h4>
                    <p className="text-[11.5px] text-slate-400 leading-normal">
                      Extracción de streams PDF comprimidos zlib y métricas reales de RAM.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#3b82f6]/20 text-[#60a5fa] shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">Electron Auto-Updates</h4>
                    <p className="text-[11.5px] text-slate-400 leading-normal">
                      Notificación y botón de actualización directa para usuarios instalados.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-800/80">
                <a
                  href="https://github.com/Naiker12/Sparta-Agent/releases/download/v0.1.4/Sparta-Agent-Windows-0.1.4-Setup.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleClose}
                  className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#663af3] to-[#8b5cf6] hover:from-[#5b21b6] hover:to-[#7c3aed] text-white text-xs font-bold shadow-lg shadow-[#663af3]/30 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar Sparta v0.1.4 (.exe)
                </a>

                <a
                  href="https://github.com/Naiker12/Sparta-Agent/releases/tag/v0.1.4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
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
