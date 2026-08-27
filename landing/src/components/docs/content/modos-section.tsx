import { motion } from 'framer-motion';
import { MessageSquare, Bot, ShieldCheck, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ModosSection() {
  return (
    <section className="max-w-4xl">
      <SectionHeader
        eyebrow="Seguridad y Control"
        title="Modo Chat vs Modo Agente: Separación Estricta"
        description="Sparta Agent implementa una separación por capas para garantizar que ninguna acción de escritura o ejecución ocurra sin el consentimiento explícito del usuario."
      />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Modo Chat Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[.02] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Modo Chat</h3>
              <span className="text-xs font-medium text-blue-400">Solo lectura / Consulta segura</span>
            </div>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Diseñado para exploración documental, preguntas conceptuales, análisis de código y búsquedas web.
          </p>
          <ul className="space-y-2.5 text-sm text-zinc-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>Búsqueda web en tiempo real y clima</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>Lectura de archivos y consultas RAG</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>Consultas de solo lectura en servidores MCP</span>
            </li>
            <li className="flex items-center gap-2 text-zinc-500 line-through">
              <Lock className="size-4 text-zinc-600 shrink-0" />
              <span>Creación o borrado de archivos (Bloqueado)</span>
            </li>
          </ul>
        </div>

        {/* Modo Agente Card */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[.03] p-6 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Bot className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Modo Agente</h3>
              <span className="text-xs font-medium text-emerald-400">Modificación con Autorización</span>
            </div>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Habilita capacidades autónomas completas para crear archivos, ejecutar comandos y sincronizar bases de datos.
          </p>
          <ul className="space-y-2.5 text-sm text-zinc-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>Creación y modificación de código y archivos</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>Ejecución de terminal y scripts en Sandbox</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>Escritura en Notion, Drive, GitHub mediante MCP</span>
            </li>
            <li className="flex items-center gap-2 text-amber-300 font-medium">
              <ShieldCheck className="size-4 text-amber-400 shrink-0" />
              <span>Confirmación previa con diálogo modal obligatorio</span>
            </li>
          </ul>
        </div>
      </div>

      <Alert className="mt-8 border-amber-500/20 bg-amber-500/[.04] text-white">
        <AlertTriangle className="size-4 text-amber-400" />
        <AlertTitle className="text-amber-300 font-medium">Regla de Permisos</AlertTitle>
        <AlertDescription className="text-zinc-300 text-sm">
          Si solicitas modificar o eliminar recursos mientras estás en <strong>Modo Chat</strong>, el agente te recordará activar el <strong>Modo Agente</strong> en el selector de modo para proceder de forma segura.
        </AlertDescription>
      </Alert>

      <div className="mt-12">
        <h3 className="text-xl font-semibold text-white mb-4">Diálogo Modal de Permisos</h3>
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          Cada acción de modificación en Modo Agente renderiza una tarjeta interactiva (<code>PermissionRequestDialog</code>) que describe con exactitud el archivo o comando antes de ejecutarse, con botones de aprobación y cancelación directa.
        </p>
      </div>

      <SectionCta
        title="Profundiza en la Búsqueda Profunda"
        description="Descubre cómo el agente planifica y sintetiza investigaciones web complejas."
      />
    </section>
  );
}
