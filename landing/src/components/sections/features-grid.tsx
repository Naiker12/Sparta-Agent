import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { FileText, ShieldAlert, Stethoscope, Plug } from 'lucide-react';

export function FeaturesGrid() {
  const features = [
    {
      icon: FileText,
      title: 'Planes de Ejecución Transparentes',
      desc: 'Nada de cambios invisibles. Antes de modificar tu proyecto, el agente genera un documento Markdown interactivo con la lista exacta de tareas, archivos a modificar y comandos a ejecutar.',
      badge: 'create_plan',
      color: 'text-indigo-400 bg-indigo-500/10',
    },
    {
      icon: ShieldAlert,
      title: 'Sandbox + Broker de Permisos NAPI',
      desc: 'Un broker escrito en Rust intercepta los comandos de la terminal y bloquea activamente scripts destructivos, eliminaciones accidentales y accesos fuera del workspace autorizados.',
      badge: 'Rust Security',
      color: 'text-rose-400 bg-rose-500/10',
    },
    {
      icon: Stethoscope,
      title: 'Diagnósticos Continuos Integrados',
      desc: 'Sparta Agent no da por terminada una tarea hasta haber ejecutado los compiladores y linters reales del proyecto (tsc, eslint, ruff, mypy, cargo) y haber subsanado cualquier advertencia.',
      badge: 'Auto-Diagnostic',
      color: 'text-amber-400 bg-amber-500/10',
    },
    {
      icon: Plug,
      title: 'Ecosistema MCP Extensible',
      desc: 'Soporte nativo para el Model Context Protocol (MCP). Conecta fácilmente servidores de herramientas externos como bases de datos Postgres, GitHub APIs o herramientas personalizadas.',
      badge: 'MCP Protocol',
      color: 'text-emerald-400 bg-emerald-500/10',
    },
  ];

  return (
    <section className="py-20 md:py-28 relative bg-[var(--bg-surface)]/40 border-y border-[var(--border-normal)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge variant="accent" className="text-xs uppercase font-mono tracking-wider">
            Capacidades Clave
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-[var(--text-display)]">
            Pilares Fundamentales del Producto
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-secondary)]">
            Ingeniería de grado empresarial diseñada para brindar autonomía máxima sin perder el control.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="border-[var(--border-normal)] bg-[var(--bg-elevated)]/60 hover:bg-[var(--bg-elevated)] hover:border-[var(--accent)] transition-all duration-300 p-8 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-xl ${feature.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {feature.badge}
                    </Badge>
                  </div>
                  <h3 className="text-2xl font-bold font-display text-[var(--text-display)]">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
