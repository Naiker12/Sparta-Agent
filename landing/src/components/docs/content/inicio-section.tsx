import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getPublicUrl } from '@/lib/utils';

export function InicioSection() {
  const screenshot = getPublicUrl('escritorio.png');

  return (
    <section className="max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <p className="mb-5 text-sm font-medium text-zinc-500 uppercase tracking-wider">
          Documentación de producto
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl text-white">
          Construye con un agente que entiende tu espacio de trabajo.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
          Sparta Agent reúne chat, tareas, terminal, memoria y conectores MCP en una aplicación de
          escritorio local-first. Esta guía explica las piezas que ya viven en el repositorio.
        </p>
      </motion.div>

      <Alert className="mt-8 border-white/10 bg-white/[.03] text-white">
        <BookOpen className="size-4 text-amber-300" />
        <AlertTitle className="text-white font-medium">Documentación basada en el código actual</AlertTitle>
        <AlertDescription className="text-zinc-400">
          Las guías describen módulos y flujos presentes en el monorepo. Cuando una capacidad
          depende de un proveedor, se indica como integración configurable, no como promesa de
          producto.
        </AlertDescription>
      </Alert>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
        className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[.03] p-2 shadow-sm"
      >
        <img
          src={screenshot}
          alt="Interfaz de escritorio de Sparta Agent"
          className="aspect-[16/8.4] w-full rounded-xl object-cover object-top"
        />
      </motion.div>
    </section>
  );
}
