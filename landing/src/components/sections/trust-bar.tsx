import { Cpu, Shield, Code, Server, Layers, Wrench } from 'lucide-react';

export function TrustBar() {
  const techStack = [
    { name: 'React 18', role: 'UI Presentation', icon: Code, color: 'text-sky-400' },
    { name: 'TypeScript 5', role: 'Type Safety', icon: Wrench, color: 'text-blue-400' },
    { name: 'Electron 30', role: 'Desktop Runtime', icon: Layers, color: 'text-cyan-300' },
    { name: 'Python 3.11', role: 'LangGraph Sidecar', icon: Server, color: 'text-amber-400' },
    { name: 'Rust 1.85', role: 'Security Broker', icon: Shield, color: 'text-orange-400' },
    { name: 'LangGraph', role: 'Reasoning Engine', icon: Cpu, color: 'text-indigo-400' },
  ];

  return (
    <section className="py-10 border-y border-[var(--border-normal)] bg-[var(--bg-surface)]/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-6">
          ARQUITECTURA DE PRODUCCIÓN PROBADA · NATIVA Y SIN DEPENDENCIAS CLOUD OBLIGATORIAS
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {techStack.map((tech) => {
            const Icon = tech.icon;
            return (
              <div
                key={tech.name}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-elevated)]/60 border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all group"
              >
                <div className={`p-2 rounded-lg bg-[var(--bg-surface)] ${tech.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text-display)] font-mono">{tech.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{tech.role}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
