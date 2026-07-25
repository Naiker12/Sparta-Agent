import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { CheckCircle2, Clock } from 'lucide-react';

export function Roadmap() {
  const completed = [
    'Agente básico en Python con LangGraph (Plan → Act → Reflect)',
    'Integración de Monaco Editor + xterm.js en Electron 30',
    'Broker de seguridad nativo en Rust (CommandSanitizer + PathGuard)',
    'Soporte multi-modelo (Ollama, Llama 3, Anthropic Claude, Gemini, OpenAI)',
    'Generación de planes de ejecución en tiempo real (create_plan)',
    'Ecosistema de skills modular (.agents/skills/)',
    'Soporte nativo para el protocolo MCP (Model Context Protocol)',
  ];

  const inProgress = [
    'Soporte parcial para extensiones de VS Code',
    'Memoria a largo plazo persistente con ChromaDB vectorial',
    'Sincronización P2P encriptada para equipos de ingeniería',
    'Subagentes paralelos masivos con balanceo dinámico de cuotas',
  ];

  return (
    <section id="roadmap" className="py-20 md:py-28 relative bg-[var(--bg-surface)]/30 border-y border-[var(--border-normal)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge variant="accent" className="text-xs uppercase font-mono tracking-wider">
            Roadmap del Proyecto
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-[var(--text-display)]">
            Estado de Desarrollo y Hoja de Ruta
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-secondary)]">
            Progreso público transparente tomado 1:1 de nuestro repositorio oficial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Completed Features */}
          <Card className="border-emerald-500/30 bg-[var(--bg-elevated)] p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold font-display text-[var(--text-display)]">
                  Logrado (v0.1)
                </h3>
              </div>
              <Badge variant="success">Completado</Badge>
            </div>

            <ul className="space-y-3 font-mono text-xs text-[var(--text-primary)]">
              {completed.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* In Progress Features */}
          <Card className="border-amber-500/30 bg-[var(--bg-elevated)] p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold font-display text-[var(--text-display)]">
                  En Desarrollo / Siguiente
                </h3>
              </div>
              <Badge variant="warning">En Progreso</Badge>
            </div>

            <ul className="space-y-3 font-mono text-xs text-[var(--text-secondary)]">
              {inProgress.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-amber-400 font-bold">⏳</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </section>
  );
}
