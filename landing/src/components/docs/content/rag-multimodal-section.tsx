import { motion } from 'framer-motion';
import { Database, FileText, Search, Cpu, CheckCircle2 } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';

export function RagMultimodalSection() {
  return (
    <section className="max-w-4xl">
      <SectionHeader
        eyebrow="Base de Conocimiento Local"
        title="RAG Local Multimodal e Híbrido"
        description="Indexación semántica y búsqueda híbrida para que el agente responda fundamentado en tus documentos privados sin enviarlos a la nube."
      />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/[.02] p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-4">
            <Cpu className="size-5" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Búsqueda Vectorial (Densa)</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Utiliza modelos de embeddings locales en formato GGUF para capturar significado semántico, intenciones, sinónimos y relaciones complejas.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[.02] p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-4">
            <Search className="size-5" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Búsqueda Léxica FTS5 (Dispersa)</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Motor SQLite FTS5 de alto rendimiento para coincidencia exacta de nombres propios, números de serie, identificadores técnicos y código.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-xl font-semibold text-white mb-4">Formatos Soportados</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-sm">
          {[
            { name: 'Documentos PDF', ext: '.pdf' },
            { name: 'Hojas Excel', ext: '.xlsx, .xls' },
            { name: 'Documentos Word', ext: '.docx, .doc' },
            { name: 'Archivos CSV', ext: '.csv, .tsv' },
            { name: 'Presentaciones', ext: '.pptx, .key' },
            { name: 'Código TypeScript', ext: '.ts, .tsx' },
            { name: 'Código Python', ext: '.py' },
            { name: 'Archivos Markdown', ext: '.md, .txt' },
          ].map((item) => (
            <div key={item.name} className="rounded-xl border border-white/10 bg-white/[.02] p-3.5">
              <span className="font-medium text-white block">{item.name}</span>
              <span className="text-xs text-zinc-500 font-mono">{item.ext}</span>
            </div>
          ))}
        </div>
      </div>

      <SectionCta
        title="Visualización de Adjuntos"
        description="Conoce los chips y clasificación por extensión de archivos."
      />
    </section>
  );
}
