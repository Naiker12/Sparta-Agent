import { Boxes, ChevronRight, Network, TerminalSquare, Workflow } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';
import { DiagramEmbed } from '../diagrams/diagram-embed';

const architectureLayers = [
  {
    icon: Boxes,
    title: 'Aplicación de escritorio',
    body: 'ia-sparta-app-shell organiza el ciclo de vida de Electron, ventanas nativas y registra los canales IPC seguros.',
    badge: 'Electron + Vite',
  },
  {
    icon: Workflow,
    title: 'Flujo agéntico y Chat',
    body: 'Los módulos de chat, tareas y eventos muestran planes paso a paso, actividad en tiempo real y diffs de código.',
    badge: 'ia-sparta-agents',
  },
  {
    icon: Network,
    title: 'MCP y Extensiones',
    body: 'La capa MCP administra catálogo, conexión JSON-RPC, OAuth 2.0, ejecución y estados de los servidores.',
    badge: 'ia-sparta-mcp',
  },
  {
    icon: TerminalSquare,
    title: 'Herramientas Nativas e IPC',
    body: 'Archivos del sistema y terminal se conectan mediante un puente IPC seguro con validación de rutas y confirmaciones.',
    badge: 'Core IPC',
  },
];

export function ArquitecturaSection() {
  return (
    <section id="arquitectura" className="max-w-4xl">
      <SectionHeader
        eyebrow="Arquitectura"
        title="Capas claras, responsabilidades separadas"
        description="Sparta Agent está estructurado como un monorepo modular donde cada subsistema mantiene fronteras estrictas mediante canales IPC tipados y contratos explícitos."
      />

      <DiagramEmbed caption="Figura 1: Pila de abstracción y flujo de datos en Sparta Agent">
        <svg viewBox="0 0 800 280" className="w-full h-auto text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Background Grid Accent */}
          <rect width="800" height="280" rx="12" fill="#09090b" />

          {/* Layer 1: App Shell */}
          <rect x="40" y="30" width="720" height="46" rx="8" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          <text x="60" y="58" fill="#f4f4f5" fontSize="14" fontWeight="600">1. Capa de Presentación (Electron App Shell &amp; React UI)</text>
          <text x="630" y="58" fill="#a1a1aa" fontSize="12" fontFamily="monospace">frontend-spartan</text>

          {/* Arrow */}
          <path d="M400 77 L400 93" stroke="#e4e4e7" strokeWidth="1.5" strokeDasharray="3 3" />
          <polygon points="396,93 400,100 404,93" fill="#e4e4e7" />

          {/* Layer 2: Agent Orchestrator */}
          <rect x="40" y="102" width="720" height="46" rx="8" fill="#18181b" stroke="#f59e0b" strokeWidth="1.2" />
          <text x="60" y="130" fill="#fbbf24" fontSize="14" fontWeight="600">2. Motor de Agentes &amp; Planificador de Tareas</text>
          <text x="642" y="130" fill="#fbbf24" fontSize="12" fontFamily="monospace">ia-sparta-agents</text>

          {/* Arrow */}
          <path d="M400 149 L400 165" stroke="#e4e4e7" strokeWidth="1.5" strokeDasharray="3 3" />
          <polygon points="396,165 400,172 404,165" fill="#e4e4e7" />

          {/* Layer 3: MCP & Protocol */}
          <rect x="40" y="174" width="350" height="70" rx="8" fill="#18181b" stroke="#3b82f6" strokeWidth="1" />
          <text x="60" y="202" fill="#60a5fa" fontSize="13" fontWeight="600">3. Conectores MCP &amp; Skills</text>
          <text x="60" y="226" fill="#9ca3af" fontSize="11">Servidores locales/remotos (JSON-RPC + OAuth)</text>

          {/* Layer 4: IPC Security Bridge & System */}
          <rect x="410" y="174" width="350" height="70" rx="8" fill="#18181b" stroke="#10b981" strokeWidth="1" />
          <text x="430" y="202" fill="#34d399" fontSize="13" fontWeight="600">4. Puente IPC Seguro &amp; Terminal</text>
          <text x="430" y="226" fill="#9ca3af" fontSize="11">Validación de comandos destructivos y sandbox</text>
        </svg>
      </DiagramEmbed>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {architectureLayers.map(({ icon: Icon, title, body, badge }) => (
          <article
            key={title}
            className="group rounded-xl border border-white/10 bg-white/[.02] p-5 transition hover:border-white/25 hover:bg-white/[.04]"
          >
            <div className="flex items-center justify-between">
              <Icon className="size-5 text-amber-300" strokeWidth={1.6} />
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                {badge}
              </span>
            </div>
            <h3 className="mt-6 font-medium text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
            <a
              href="https://github.com/Naiker12/Sparta-Agent"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Ver código en GitHub <ChevronRight className="size-4" />
            </a>
          </article>
        ))}
      </div>

      <SectionCta />
    </section>
  );
}
