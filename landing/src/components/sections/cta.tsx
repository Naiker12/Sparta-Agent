import { ArrowRight, Sparkles, Terminal } from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';

export function CTA() {
  return (
    <section className="py-16 relative bg-[#07050d] text-white border-t border-white/10 font-sans">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[220px] bg-[#663af3]/15 blur-[120px] pointer-events-none" />

      {/* UNIFIED CONTINUOUS GRID CONTAINER MAX-W-7XL BORDER-X */}
      <div className="mx-auto max-w-7xl border-x border-white/10 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#663af3]/10 border border-[#663af3]/30 text-xs font-mono text-[#a855f7] font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Desarrollo de IA Local y Autónomo</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
            Mira al agente planificar y ejecutar su primera tarea en tu propia máquina.
          </h2>

          <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">
            Sparta Agent es de código abierto. Sin suscripciones forzadas, sin filtración de datos y con control total sobre tus modelos de lenguaje.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="https://github.com/Naiker12/Sparta-Agent"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="px-6 py-2.5 rounded-xl bg-[#663af3] hover:bg-[#7c4dff] text-white font-mono font-bold text-xs shadow-lg shadow-[#663af3]/40 transition-all cursor-pointer flex items-center gap-2 border border-[#663af3]">
                <GithubIcon className="w-4 h-4 text-white" />
                <span>Ver y Clonar en GitHub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </a>
            <a href="#quick-start">
              <button className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 font-mono font-bold text-xs transition-all cursor-pointer flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[#a855f7]" />
                <span>Ir al Quick Start</span>
              </button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
