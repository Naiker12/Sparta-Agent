import { CheckCircle2, FileCode2, ListOrdered, Sparkles, Waypoints } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';
import { DiagramEmbed } from '../diagrams/diagram-embed';
import { getPublicUrl } from '@/lib/utils';

export function AgentesSection() {
  const screenshot = getPublicUrl('proyecto/SPARTAN-PRINCIPAL.png');

  return (
    <section id="agentes" className="max-w-4xl">
      <SectionHeader
        eyebrow="Producto"
        title="Agentes, planes y actividad"
        description="El paquete ia-sparta-agents separa el ciclo de tareas de la interfaz. La aplicación muestra el plan, los subagentes, las herramientas y los cambios para que puedas seguir una ejecución antes de aceptar su resultado."
      />

      <DiagramEmbed caption="Figura 2: Ciclo de vida de una tarea agéntica en Sparta Agent">
        <svg viewBox="0 0 800 200" className="w-full h-auto text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="200" rx="12" fill="#09090b" />

          {/* Step 1: Input / Goal */}
          <rect x="30" y="55" width="160" height="90" rx="10" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
          <text x="50" y="90" fill="#e4e4e7" fontSize="14" fontWeight="600">1. Objetivo</text>
          <text x="50" y="112" fill="#a1a1aa" fontSize="11">Prompt o tarea</text>
          <text x="50" y="128" fill="#a1a1aa" fontSize="11">del usuario</text>

          {/* Arrow 1 */}
          <path d="M190 100 L220 100" stroke="#f59e0b" strokeWidth="2" />
          <polygon points="220,96 228,100 220,104" fill="#f59e0b" />

          {/* Step 2: Plan */}
          <rect x="230" y="55" width="160" height="90" rx="10" fill="#18181b" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="250" y="90" fill="#fbbf24" fontSize="14" fontWeight="600">2. Plan Estructurado</text>
          <text x="250" y="112" fill="#a1a1aa" fontSize="11">Desglose de pasos</text>
          <text x="250" y="128" fill="#a1a1aa" fontSize="11">y dependencias</text>

          {/* Arrow 2 */}
          <path d="M390 100 L420 100" stroke="#f59e0b" strokeWidth="2" />
          <polygon points="420,96 428,100 420,104" fill="#f59e0b" />

          {/* Step 3: Execution / Tools */}
          <rect x="430" y="55" width="160" height="90" rx="10" fill="#18181b" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="450" y="90" fill="#60a5fa" fontSize="14" fontWeight="600">3. Ejecución</text>
          <text x="450" y="112" fill="#a1a1aa" fontSize="11">Subagentes, MCP</text>
          <text x="450" y="128" fill="#a1a1aa" fontSize="11">y terminal nativa</text>

          {/* Arrow 3 */}
          <path d="M590 100 L620 100" stroke="#10b981" strokeWidth="2" />
          <polygon points="620,96 628,100 620,104" fill="#10b981" />

          {/* Step 4: Review / Diff */}
          <rect x="630" y="55" width="140" height="90" rx="10" fill="#18181b" stroke="#10b981" strokeWidth="1.5" />
          <text x="648" y="90" fill="#34d399" fontSize="14" fontWeight="600">4. Revisión</text>
          <text x="648" y="112" fill="#a1a1aa" fontSize="11">Diffs y aprobación</text>
          <text x="648" y="128" fill="#a1a1aa" fontSize="11">explícita</text>
        </svg>
      </DiagramEmbed>

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: ListOrdered,
            title: 'Plan y Desglose',
            body: 'Genera un árbol de pasos ejecutables antes de iniciar cualquier acción en el espacio de trabajo.',
          },
          {
            icon: Waypoints,
            title: 'Actividad en Vivo',
            body: 'Streaming en tiempo real de tool calls, respuestas intermedias y ejecuciones de subagentes.',
          },
          {
            icon: FileCode2,
            title: 'Revisión y Diffs',
            body: 'Visualización visual de cambios en archivos para que apruebes cada modificación de código.',
          },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-white/10 bg-white/[.02] p-5">
            <Icon className="mb-4 size-5 text-amber-300" strokeWidth={1.6} />
            <p className="font-medium text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-sm">
        <img
          src={screenshot}
          alt="Panel de agentes y actividad en Sparta Agent"
          className="aspect-[16/9] w-full rounded-xl object-cover object-top"
        />
      </div>

      <SectionCta />
    </section>
  );
}
