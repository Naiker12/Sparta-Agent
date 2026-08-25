import { ArrowRight, Github } from 'lucide-react';

interface SectionCtaProps {
  title?: string;
  description?: string;
}

export function SectionCta({
  title = '¿Listo para explorar el proyecto?',
  description = 'Consulta el código, ejecuta el entorno local y adapta los conectores a tu flujo.',
}: SectionCtaProps) {
  return (
    <section className="mt-20 max-w-4xl border-t border-white/10 py-12">
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-3 text-zinc-400">{description}</p>
      <a
        href="https://github.com/Naiker12/Sparta-Agent"
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
      >
        <Github className="size-4" /> Abrir repositorio <ArrowRight className="size-4" />
      </a>
    </section>
  );
}
