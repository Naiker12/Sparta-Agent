import { motion } from 'framer-motion';
import { Search, Sparkles, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function DeepResearchSection() {
  const steps = [
    {
      num: '01',
      title: 'Planificación Adaptativa',
      desc: 'El modelo desglosa tu consulta en un plan de 2 a 6 pasos no superpuestos con términos de búsqueda concretos.',
    },
    {
      num: '02',
      title: 'Búsquedas Web Iterativas',
      desc: 'Ejecuta consultas concurrentes, clasifica resultados y extrae texto enriquecido de páginas web clave.',
    },
    {
      num: '03',
      title: 'Decisión y Refinamiento',
      desc: 'El agente evalúa vacíos de información o contradicciones y ajusta las consultas para corroborar hechos.',
    },
    {
      num: '04',
      title: 'Auditoría de Síntesis',
      desc: 'Mapea cada afirmación con fuentes verificadas del catálogo antes de generar el informe final.',
    },
    {
      num: '05',
      title: 'Reporte Estructurado con Citas',
      desc: 'Genera un documento completo en Markdown con análisis detallado y citas directas [Fuente](URL).',
    },
  ];

  return (
    <section className="max-w-4xl">
      <SectionHeader
        eyebrow="Investigación Autónoma"
        title="Búsqueda Profunda (Deep Research)"
        description="Transforma preguntas complejas en investigaciones estructuradas multi-etapa con validación de fuentes y generación de informes ejecutivos."
      />

      <div className="mt-8 space-y-4">
        {steps.map((step) => (
          <div
            key={step.num}
            className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[.02] p-5 hover:border-emerald-500/30 transition-colors"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-sm font-bold border border-emerald-500/20">
              {step.num}
            </span>
            <div>
              <h4 className="text-base font-semibold text-white mb-1">{step.title}</h4>
              <p className="text-sm text-zinc-400 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Alert className="mt-8 border-emerald-500/20 bg-emerald-500/[.03] text-white">
        <Sparkles className="size-4 text-emerald-400" />
        <AlertTitle className="text-emerald-300 font-medium">Panel de Actividad en Vivo</AlertTitle>
        <AlertDescription className="text-zinc-300 text-sm">
          Durante la investigación puedes pulsar <strong>"Ver actividad"</strong> para inspeccionar los pasos del plan, consultas ejecutadas, URLs descubiertas y trazas de razonamiento en tiempo real.
        </AlertDescription>
      </Alert>

      <SectionCta
        title="Conecta tus datos con RAG Multimodal"
        description="Aprende a indexar documentos PDF, Excel y bases de conocimiento local."
      />
    </section>
  );
}
