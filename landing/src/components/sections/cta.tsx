import { Button } from '../ui/button';
import { ArrowRight, Sparkles, Terminal } from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';

export function CTA() {
  return (
    <section className="py-20 md:py-28 relative bg-gradient-to-b from-[var(--bg-base)] via-[var(--bg-surface)] to-[var(--bg-base)] border-t border-[var(--border-normal)]">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
        <div className="inline-flex items-center gap-2 p-2 px-4 rounded-full bg-[var(--accent-muted)] border border-[var(--accent)]/30 text-xs font-mono text-[var(--accent)]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Desarrollo de IA Local y Autónomo</span>
        </div>

        <h2 className="text-4xl sm:text-6xl font-bold font-display tracking-tight text-[var(--text-display)] max-w-4xl mx-auto">
          Mira al agente planificar y ejecutar su primera tarea en tu propia máquina.
        </h2>

        <p className="text-base sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
          Sparta Agent es de código abierto. Sin suscripciones forzadas, sin filtración de datos y con control total sobre tus modelos de lenguaje.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <a
            href="https://github.com/Naiker12/Sparta-Agent"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto"
          >
            <Button size="lg" className="w-full sm:w-auto gap-3 px-8 font-semibold">
              <GithubIcon className="w-5 h-5" />
              <span>Ver y Clonar en GitHub</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
          <a href="#quick-start" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 px-7">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>Ir al Quick Start</span>
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
