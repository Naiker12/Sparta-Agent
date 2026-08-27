import { motion } from 'framer-motion';
import { FileCode, FileSpreadsheet, FileText, Image, Video, Music, Archive, FileQuestion } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';

export function AdjuntosSection() {
  const kinds = [
    { title: 'PDF', exts: '.pdf', icon: FileText, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    { title: 'Word / Texto', exts: '.docx, .doc, .rtf', icon: FileText, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { title: 'Excel / Tablas', exts: '.xlsx, .xls, .ods', icon: FileSpreadsheet, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { title: 'CSV / Datos', exts: '.csv, .tsv', icon: FileSpreadsheet, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
    { title: 'Imágenes', exts: '.png, .jpg, .webp, .svg', icon: Image, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    { title: 'Video', exts: '.mp4, .webm, .mov', icon: Video, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    { title: 'Audio', exts: '.mp3, .wav, .m4a', icon: Music, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { title: 'Código Fuente', exts: '.ts, .tsx, .py, .json', icon: FileCode, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
    { title: 'Comprimidos', exts: '.zip, .tar, .gz', icon: Archive, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  ];

  return (
    <section className="max-w-4xl">
      <SectionHeader
        eyebrow="Experiencia de Usuario"
        title="Gestión Visual de Adjuntos"
        description="Sparta Agent detecta de forma inteligente el tipo de archivo mediante MIME y extensiones, renderizando chips visuales con íconos dinámicos en el compositor de chat."
      />

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {kinds.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/[.02] p-4 hover:border-white/20 transition-all"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${item.color}`}>
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-white truncate">{item.title}</h4>
                <p className="text-xs text-zinc-500 font-mono truncate">{item.exts}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[.02] p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Comportamiento al Adjuntar</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Los archivos pequeños se inyectan como contexto directo al prompt del modelo. Los documentos extensos (ej. manuales de más de 50 páginas) se procesan a través del indexador semántico local para no saturar la ventana de tokens.
        </p>
      </div>

      <SectionCta
        title="Herramientas en Tiempo Real"
        description="Aprende sobre las herramientas nativas de clima, fecha y búsqueda web."
      />
    </section>
  );
}
