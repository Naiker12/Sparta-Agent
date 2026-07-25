import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { SectionHeader } from '../ui/section-header';
import { Layout, Server, Cpu, ArrowDown } from 'lucide-react';

export function Architecture() {
  const layers = [
    {
      step: 'CAPA 1',
      title: 'Capa de Presentación (Frontend IDE)',
      stack: 'React 18 · Monaco Editor · xterm.js · Tailwind v4',
      icon: Layout,
      color: 'border-sky-500/15 text-sky-400 bg-sky-500/5',
      desc: 'Interfaz de usuario ultrarrápida que proporciona un editor Monaco completo, paneles de chat agéntico, terminales interactivas xterm.js y visualización de planes en tiempo real.',
      features: ['Renderizado fluído a 60fps', 'Terminal integrada xterm.js', 'Modo Claro / Oscuro nativo con tokens base.css'],
    },
    {
      step: 'CAPA 2',
      title: 'Capa de Orquestación (IPC & Security)',
      stack: 'Electron Main · FastAPI · Broker NAPI Rust · Vault Cifrado',
      icon: Server,
      color: 'border-indigo-500/15 text-indigo-400 bg-indigo-500/5',
      desc: 'Puente IPC seguro y ligero. El broker en Rust intercepta todas las llamadas I/O del SO, valida el sanitizer de comandos y cifra los secretos en el Vault del SO.',
      features: ['CommandSanitizer en Rust native', 'PathGuard & Denylist activo', 'Vault cifrado AES-256 local'],
    },
    {
      step: 'CAPA 3',
      title: 'Núcleo de Inteligencia (LangGraph Sidecar)',
      stack: 'Python 3.11 · LangGraph · ChromaDB Vector Memory · MCP Engine',
      icon: Cpu,
      color: 'border-purple-500/15 text-purple-400 bg-purple-500/5',
      desc: 'El cerebro agéntico autónomo. Corre como un proceso sidecar aislado ejecutando grafos de estados deterministas para planificar, invocar tools y reflexionar.',
      features: ['Bucle Plan → Act → Reflect', 'Coordinación de subagentes', 'Memoria vectorial ChromaDB integrada'],
    },
  ];

  return (
    <section id="arquitectura" className="py-24 md:py-32 relative bg-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Unified Section Header */}
        <SectionHeader
          eyebrow="Arquitectura Interna // Decoupled"
          title="Estructura Decoupled de 3 Capas"
          description="Sin bloqueos en el hilo principal de la UI. Separación limpia de responsabilidades entre presentación, orquestación nativa y razonamiento Python."
        />

        <div className="max-w-4xl mx-auto space-y-6 relative">
          {layers.map((layer, index) => {
            const Icon = layer.icon;
            return (
              <div key={layer.step} className="relative">
                <Card className="border-[var(--border-normal)] bg-[rgba(186,214,247,0.02)] p-6 md:p-8 hover:border-indigo-500/40 transition-all duration-300">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-[rgba(186,215,247,0.06)]">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl border ${layer.color}`}>
                        <Icon className="w-5.5 h-5.5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-indigo-400 font-bold">{layer.step}</span>
                        <h3 className="text-xl font-bold font-display text-[#d8ecf8]">
                          {layer.title}
                        </h3>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs self-start md:self-auto font-semibold">
                      {layer.stack}
                    </Badge>
                  </div>

                  <p className="text-sm text-[#c7d3ea] leading-relaxed mb-4">
                    {layer.desc}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {layer.features.map((feat, fIdx) => (
                      <div key={fIdx} className="text-xs font-mono font-medium text-[#d1e4fa] bg-[#05060f] p-3 rounded-lg border border-[rgba(186,215,247,0.08)]">
                        • {feat}
                      </div>
                    ))}
                  </div>
                </Card>

                {index < layers.length - 1 && (
                  <div className="flex justify-center my-4 text-indigo-400">
                    <ArrowDown className="w-5 h-5 animate-bounce" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
