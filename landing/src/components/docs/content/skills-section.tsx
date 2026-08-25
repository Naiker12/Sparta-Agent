import { BookMarked, Cpu, FileCheck2, FolderTree, Sparkles } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';
import { DiagramEmbed } from '../diagrams/diagram-embed';
import { CodeBlock } from './code-block';

export function SkillsSection() {
  return (
    <section id="skills" className="max-w-4xl">
      <SectionHeader
        eyebrow="Extensibilidad"
        title="Skills para especializar el agente"
        description="El repositorio mantiene un catálogo estructurado de skills y un canal IPC específico para descubrirlas y cargarlas bajo demanda. Así, las instrucciones especializadas y flujos de trabajo se mantienen como capacidades auditables del proyecto, en lugar de perderse en un prompt efímero."
      />

      <DiagramEmbed caption="Figura 5: Estructura y ciclo de resolución de Skills">
        <svg viewBox="0 0 800 180" className="w-full h-auto text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="180" rx="12" fill="#09090b" />

          {/* Directory */}
          <rect x="40" y="45" width="200" height="90" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
          <text x="60" y="75" fill="#f4f4f5" fontSize="13" fontWeight="600">.agents/skills/</text>
          <text x="60" y="98" fill="#a1a1aa" fontSize="11">• SKILL.md (metadata)</text>
          <text x="60" y="115" fill="#a1a1aa" fontSize="11">• scripts/ &amp; templates/</text>

          {/* IPC Loader */}
          <rect x="290" y="45" width="220" height="90" rx="8" fill="#18181b" stroke="#f59e0b" strokeWidth="1.2" />
          <text x="310" y="75" fill="#fbbf24" fontSize="13" fontWeight="600">IPC Loader &amp; Indexer</text>
          <text x="310" y="98" fill="#a1a1aa" fontSize="11">• Inyección contextual</text>
          <text x="310" y="115" fill="#a1a1aa" fontSize="11">• Activación semántica</text>

          {/* Agent Context */}
          <rect x="560" y="45" width="200" height="90" rx="8" fill="#18181b" stroke="#10b981" strokeWidth="1.2" />
          <text x="580" y="75" fill="#34d399" fontSize="13" fontWeight="600">Contexto del Agente</text>
          <text x="580" y="98" fill="#a1a1aa" fontSize="11">• Ejecución guiada</text>
          <text x="580" y="115" fill="#a1a1aa" fontSize="11">• Flujos estandarizados</text>

          <path d="M240 90 L290 90" stroke="#f59e0b" strokeWidth="2" />
          <path d="M510 90 L560 90" stroke="#10b981" strokeWidth="2" />
        </svg>
      </DiagramEmbed>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-5">
          <FolderTree className="mb-4 size-5 text-amber-300" strokeWidth={1.6} />
          <h3 className="font-medium text-white">Estructura Declarativa</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Cada skill define su encabezado YAML con nombre, descripción, herramientas requeridas y dependencias.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-5">
          <FileCheck2 className="mb-4 size-5 text-emerald-400" strokeWidth={1.6} />
          <h3 className="font-medium text-white">Auditoría y Versión</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Las skills viven dentro del control de versiones (Git), permitiendo revisiones de código en equipo.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-5">
          <Cpu className="mb-4 size-5 text-blue-400" strokeWidth={1.6} />
          <h3 className="font-medium text-white">Carga Bajo Demanda</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            El agente solo incorpora el contenido completo de la skill cuando la tarea en curso lo requiere.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <p className="mb-3 text-sm font-medium text-zinc-400">Ejemplo de estructura de una Skill (`SKILL.md`):</p>
        <CodeBlock
          command={`---\nname: shadcn-ui-builder\ndescription: Guía para construir componentes accesibles con Tailwind\n---\n# Instrucciones de la skill...`}
          title="SKILL.md"
        />
      </div>

      <SectionCta />
    </section>
  );
}
