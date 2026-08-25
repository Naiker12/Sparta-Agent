import { Laptop, TerminalSquare, Workflow } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';
import { CodeBlock } from './code-block';

const steps = [
  {
    icon: Laptop,
    title: '1. Prepara el entorno',
    body: 'Node.js 18+ y pnpm 10+ son los requisitos del monorepo.',
  },
  {
    icon: TerminalSquare,
    title: '2. Instala dependencias',
    body: 'La instalación une los paquetes del escritorio y sus módulos compartidos.',
  },
  {
    icon: Workflow,
    title: '3. Abre Sparta Agent',
    body: 'El comando de desarrollo inicia la aplicación basada en Electron y Vite.',
  },
];

export function PrimerosPasosSection() {
  return (
    <section id="primeros-pasos" className="max-w-4xl">
      <SectionHeader
        eyebrow="Primeros pasos"
        title="Ejecuta Sparta Agent localmente"
        description="El repositorio usa pnpm y centraliza los paquetes de la aplicación de escritorio dentro de desktop/. Después de instalar, Vite inicia el flujo de desarrollo definido por el proyecto."
      />

      <div className="mt-7">
        <CodeBlock />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-xl border border-white/10 bg-white/[.02] p-5 transition hover:border-white/20"
          >
            <Icon className="mb-6 size-5 text-amber-300" strokeWidth={1.6} />
            <h3 className="font-medium text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
          </div>
        ))}
      </div>

      <SectionCta />
    </section>
  );
}
