import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Layout, Server, Cpu, ArrowDown, Shield, Database, Lock, KeyRound } from 'lucide-react';

export function Architecture() {
  const layers = [
    {
      step: 'CAPA 1',
      title: 'Capa de Presentación (Frontend IDE)',
      stack: 'React 18 · Monaco Editor · xterm.js · Tailwind v4',
      icon: Layout,
      color: 'border-sky-500/40 text-sky-400 bg-sky-500/10',
      desc: 'Interfaz de usuario ultrarrápida que proporciona un editor Monaco completo, paneles de chat agéntico, terminales interactivas xterm.js y visualización de planes en tiempo real.',
      features: ['Renderizado fluído a 60fps', 'Terminal integrada xterm.js', 'Modo Claro / Oscuro nativo con tokens base.css'],
    },
    {
      step: 'CAPA 2',
      title: 'Capa de Orquestación (IPC & Security)',
      stack: 'Electron Main · FastAPI · Broker NAPI Rust · Vault Cifrado',
      icon: Server,
      color: 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10',
      desc: 'Puente IPC seguro y ligero. El broker en Rust intercepta todas las llamadas I/O del SO, valida el sanitizer de comandos y cifra los secretos en el Vault del SO.',
      features: ['CommandSanitizer en Rust native', 'PathGuard & Denylist activo', 'Vault cifrado AES-256 local'],
    },
    {
      step: 'CAPA 3',
      title: 'Núcleo de Inteligencia (LangGraph Sidecar)',
      stack: 'Python 3.11 · LangGraph · ChromaDB Vector Memory · MCP Engine',
      icon: Cpu,
      color: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
      desc: 'El cerebro agéntico autónomo. Corre como un proceso sidecar aislado ejecutando grafos de estados deterministas para planificar, invocar tools y reflexionar.',
      features: ['Bucle Plan → Act → Reflect', 'Coordinación de subagentes', 'Memoria vectorial ChromaDB integrada'],
    },
  ];

  return (
    <section id="arquitectura" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge variant="default" className="text-xs uppercase font-mono tracking-wider">
            Arquitectura Interna
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-[var(--text-display)]">
            Estructura Decoupled de 3 Capas
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-secondary)]">
            Sin bloqueos en el hilo principal de la UI. Separación limpia de responsabilidades entre presentación, orquestación nativa y razonamiento Python.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6 relative">
          {layers.map((layer, index) => {
            const Icon = layer.icon;
            return (
              <div key={layer.step} className="relative">
                <Card className="border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 md:p-8 hover:border-[var(--accent)] transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-[var(--border-subtle)]">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${layer.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-mono text-[var(--accent)] font-bold">{layer.step}</span>
                        <h3 className="text-xl font-bold font-display text-[var(--text-display)]">
                          {layer.title}
                        </h3>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs self-start md:self-auto">
                      {layer.stack}
                    </Badge>
                  </div>

                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                    {layer.desc}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {layer.features.map((feat, fIdx) => (
                      <div key={fIdx} className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-base)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
                        • {feat}
                      </div>
                    ))}
                  </div>
                </Card>

                {index < layers.length - 1 && (
                  <div className="flex justify-center my-3 text-[var(--text-muted)]">
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
