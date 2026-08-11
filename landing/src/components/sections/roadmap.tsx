import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { SectionHeader } from '../ui/section-header';
import { CheckCircle2, Clock } from 'lucide-react';

export function Roadmap() {
  const completed = [
    'Runtime agéntico nativo en TypeScript (Plan → Act → Reflect)',
    'Motor de Gráficas V2 (8 tipos, 5 temas visuales, exportación HD)',
    'Subagentes delegados paralelos (delegate_research, delegate_code)',
    'Trazado visual de búsqueda web estilo Claude Code con auto-colapso',
    'Instalación local asInvoker (NSIS) sin elevación de UAC',
    'Integración de Monaco Editor + Base UI + xterm.js en Electron 30',
    'Broker de seguridad local (CommandSanitizer + PathGuard)',
    'Soporte multi-modelo (Ollama, Llama 3, Anthropic Claude, Gemini, OpenAI)',
    'Generación de planes de ejecución en tiempo real (create_plan)',
    'Ecosistema de skills modular (.agents/skills/)',
    'Soporte nativo para el protocolo MCP (Model Context Protocol)',
  ];

  const inProgress = [
    'Soporte parcial para extensiones de VS Code',
    'Memoria a largo plazo persistente con ChromaDB vectorial',
    'Sincronización P2P encriptada para equipos de ingeniería',
    'Balanceo dinámico de cuotas multi-proveedor en tiempo real',
  ];

  return (
    <section id="roadmap" className="py-24 md:py-32 relative bg-[#0a0a0a] border-t border-[rgba(186,215,247,0.12)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Unified Section Header */}
        <SectionHeader
          eyebrow="ROADMAP DEL PROYECTO"
          title="Estado de Desarrollo y Hoja de Ruta"
          description="Progreso público transparente tomado 1:1 de nuestro repositorio oficial."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Completed Features */}
          <Card className="border-[rgba(186,215,247,0.12)] bg-[rgba(186,214,247,0.02)] p-8 space-y-6 hover:border-emerald-500/20 transition-all duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(186,215,247,0.06)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold font-display text-[#d8ecf8]">
                  Logrado (v0.1.6)
                </h3>
              </div>
              <Badge variant="success">Completado</Badge>
            </div>

            <ul className="space-y-3 font-mono text-xs text-[#d1e4fa]">
              {completed.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* In Progress Features */}
          <Card className="border-[rgba(186,215,247,0.12)] bg-[rgba(186,214,247,0.02)] p-8 space-y-6 hover:border-amber-500/20 transition-all duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(186,215,247,0.06)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/5 text-amber-400 border border-amber-500/10">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold font-display text-[#d8ecf8]">
                  En Desarrollo / Siguiente
                </h3>
              </div>
              <Badge variant="warning">En Progreso</Badge>
            </div>

            <ul className="space-y-3 font-mono text-xs text-[#c7d3ea]">
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
