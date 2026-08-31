import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  ArrowRight,
  Workflow,
  BookOpen,
  Cpu,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export function ReleaseModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null); // Collapsed by default as requested

  useEffect(() => {
    // Show the announcement once for this specific release.
    const hasSeen = localStorage.getItem('sparta_release_v0.2.16_seen');
    if (!hasSeen) {
      const timer = setTimeout(() => setIsOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('sparta_release_v0.2.16_seen', 'true');
    setIsOpen(false);
  };

  const handleReopen = () => {
    setIsOpen(true);
  };

  const toggleAccordion = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const releaseFeatures = [
    {
      title: 'Actualizaciones confiables en macOS',
      summary:
        'Los releases de macOS incluyen el ZIP necesario para que Electron encuentre, descargue e instale nuevas versiones.',
      details: [
        'El empaquetado genera instaladores DMG para descarga manual y ZIP para Squirrel.Mac.',
        'El workflow publica el ZIP junto con latest-mac.yml y los demás artefactos.',
        'La comprobación de versiones vuelve a funcionar en instalaciones empaquetadas de macOS.',
      ],
      docSlug: 'quickstart',
      icon: Workflow,
      iconColor: 'text-[#ff6363]',
      iconBg: 'bg-[#ff6363]/10 border-[#ff6363]/25',
    },
    {
      title: 'Aviso de actualización minimizable',
      summary:
        'El aviso ya no bloquea permanentemente la interfaz y puede reducirse a un indicador flotante.',
      details: [
        'Cada versión puede minimizarse y volver a abrirse sin perder el estado.',
        'Durante una descarga minimizada se mantiene visible el porcentaje de progreso.',
        'Una versión nueva vuelve a mostrar el aviso aunque la anterior se hubiera minimizado.',
      ],
      docSlug: 'quickstart',
      icon: BookOpen,
      iconColor: 'text-[#63a1ff]',
      iconBg: 'bg-[#63a1ff]/10 border-[#63a1ff]/25',
    },
    {
      title: 'Notas de versión más resistentes',
      summary:
        'Las novedades aparecen de inmediato y ya no dependen únicamente del arranque del backend local.',
      details: [
        'El texto incluido en el manifiesto del actualizador funciona como respaldo inmediato.',
        'La consulta enriquecida de novedades reintenta automáticamente los fallos transitorios.',
        'Las notas se conservan al finalizar la descarga y al preparar la instalación.',
      ],
      docSlug: 'quickstart',
      icon: Cpu,
      iconColor: 'text-[#fbbf24]',
      iconBg: 'bg-[#fbbf24]/10 border-[#fbbf24]/25',
    },
    {
      title: 'Instalación segura en Linux',
      summary:
        'Sparta comprueba que se esté ejecutando desde un AppImage válido antes de intentar reemplazarlo.',
      details: [
        'Se evita cerrar la aplicación con una instalación automática que no puede completarse.',
        'Los entornos incompatibles reciben una explicación y pueden descargar el AppImage manualmente.',
        'El flujo compatible conserva la descarga, instalación y reinicio administrados por Electron.',
      ],
      docSlug: 'quickstart',
      icon: Sparkles,
      iconColor: 'text-[#59d499]',
      iconBg: 'bg-[#59d499]/10 border-[#59d499]/25',
    },
  ];

  return (
    <>
      {/* Floating Announcement Trigger Button when modal is closed */}
      {!isOpen && (
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleReopen}
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-[#07080a] border border-[#363739] shadow-key backdrop-blur-xl text-xs font-medium text-[#9c9c9d] hover:text-white hover:border-white/30 transition-all group cursor-pointer"
        >
          <img
            src="/favicon.svg"
            alt="Sparta Agent"
            className="size-4 object-contain drop-shadow-[0_0_6px_rgba(234,179,8,0.5)] group-hover:scale-110 transition-transform duration-200"
          />
          <span className="font-mono text-[11px] text-[#e6e6e6]">v0.2.16 disponible</span>
          <Sparkles className="w-3.5 h-3.5 text-[#ff6363]" />
        </motion.button>
      )}

      {/* Main Release Announcement Modal (Raycast Design) */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-xl overflow-hidden rounded-[20px] bg-[#07080a] border border-[#363739] shadow-key p-6 sm:p-7 text-left my-8 max-h-[90vh] flex flex-col justify-between"
            >
              {/* Subtle Atmospheric Glow */}
              <div className="absolute -top-24 -left-24 w-60 h-60 bg-[#ff6363]/8 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-[#63a1ff]/8 rounded-full blur-3xl pointer-events-none" />

              {/* Minimalist Close Button */}
              <button
                onClick={handleClose}
                className="absolute top-5 right-5 p-1.5 rounded-lg text-[#6a6b6c] hover:text-white hover:bg-white/5 transition-colors z-20 cursor-pointer"
                title="Cerrar ventana"
                aria-label="Cerrar ventana"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Release Header */}
              <div className="relative z-10 flex flex-col gap-2.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-[#111214] border border-[#363739] w-fit shadow-key">
                  <img
                    src="/favicon.svg"
                    alt="Sparta Agent"
                    className="size-3.5 object-contain drop-shadow-[0_0_4px_rgba(234,179,8,0.5)]"
                  />
                  <span className="text-[11px] font-mono font-medium tracking-[0.08em] text-[#9c9c9d] uppercase">
                    Lanzamiento oficial v0.2.16
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-white">
                  Sparta Agent v0.2.16
                </h2>

                <p className="text-xs sm:text-sm text-[#9c9c9d] leading-relaxed font-normal">
                  Haz clic en cada sección para desplegar los detalles técnicos y arquitectura de esta entrega:
                </p>
              </div>

              {/* Accordion Feature Items List */}
              <div className="relative z-10 flex flex-col gap-2.5 my-4 overflow-y-auto pr-1">
                {releaseFeatures.map((item, index) => {
                  const Icon = item.icon;
                  const isExpanded = expandedIndex === index;

                  return (
                    <div
                      key={index}
                      className={`rounded-[14px] border transition-all duration-200 shadow-key overflow-hidden ${
                        isExpanded
                          ? 'bg-[#0d0e11] border-white/30'
                          : 'bg-[#07080a] border-[#363739] hover:border-white/20'
                      }`}
                    >
                      {/* Accordion Trigger Header */}
                      <button
                        onClick={() => toggleAccordion(index)}
                        className="w-full flex items-center justify-between gap-3 p-3 sm:p-3.5 text-left focus:outline-none cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`size-8 rounded-lg border ${item.iconBg} flex items-center justify-center shrink-0 shadow-key`}
                          >
                            <Icon className={`size-4 ${item.iconColor}`} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-medium text-white tracking-tight truncate">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-[#9c9c9d] truncate mt-0.5">
                              {item.summary}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`size-6 rounded-full bg-[#111214] border border-[#363739] flex items-center justify-center text-[#9c9c9d] shrink-0 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180 text-white' : 'rotate-0'
                          }`}
                        >
                          <ChevronDown className="size-3.5" />
                        </div>
                      </button>

                      {/* Expandable Accordion Body */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                          >
                            <div className="px-3.5 pb-3.5 pt-1 border-t border-[#363739]/60 space-y-2">
                              <div className="space-y-1.5 pt-1">
                                {item.details.map((detail, dIdx) => (
                                  <div
                                    key={dIdx}
                                    className="flex items-start gap-2 text-[11.5px] text-[#9c9c9d] leading-relaxed"
                                  >
                                    <CheckCircle2 className="size-3 text-[#59d499] shrink-0 mt-1" />
                                    <span>{detail}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Documentation Link */}
                              <div className="pt-2 flex justify-end">
                                <a
                                  href={`?docs=${item.docSlug}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleClose();
                                    window.history.pushState(null, '', `?docs=${item.docSlug}`);
                                    window.dispatchEvent(new Event('popstate'));
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#63a1ff] hover:text-white transition-colors"
                                >
                                  <span>Ver documentación completa</span>
                                  <ExternalLink className="size-2.5" />
                                </a>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons Group */}
              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                <a
                  href="https://github.com/Naiker12/Sparta-Agent/releases/latest/download/Sparta-Agent-Windows-0.2.16-Setup.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleClose}
                  className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#e6e6e6] hover:bg-white text-[#454647] hover:text-[#111214] text-xs font-medium shadow-button-neutral transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Sparta v0.2.16 (.exe)</span>
                </a>

                <a
                  href="https://github.com/Naiker12/Sparta-Agent/releases/tag/v0.2.16"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#111214] hover:bg-[#1b1c1e] border border-[#363739] text-[#9c9c9d] hover:text-white text-xs font-medium transition-all shadow-key cursor-pointer"
                >
                  <span>Ver Release Notes</span>
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
