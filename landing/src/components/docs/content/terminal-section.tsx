import { AlertTriangle, Lock, ShieldCheck, TerminalSquare } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';
import { DiagramEmbed } from '../diagrams/diagram-embed';
import { CodeBlock } from './code-block';

export function TerminalSection() {
  return (
    <section id="terminal" className="max-w-4xl">
      <SectionHeader
        eyebrow="Producto"
        title="Terminal nativa con permisos explícitos"
        description="La terminal de ia-sparta-terminal se ejecuta a través del proceso principal de Electron con pseudo-terminales nativos (PTY). El agente no necesita un shell web emulado: las solicitudes pasan por el bridge IPC con validación rigurosa de comandos destructivos."
      />

      <DiagramEmbed caption="Figura 3: Arquitectura de ejecución segura de la terminal IPC">
        <svg viewBox="0 0 800 220" className="w-full h-auto text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="220" rx="12" fill="#09090b" />

          {/* UI Renderer */}
          <rect x="40" y="50" width="200" height="120" rx="10" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
          <text x="60" y="85" fill="#f4f4f5" fontSize="14" fontWeight="600">Renderer (UI)</text>
          <text x="60" y="110" fill="#a1a1aa" fontSize="12">Componente Xterm / Chat</text>
          <text x="60" y="130" fill="#a1a1aa" fontSize="12">Solicitud de comando</text>

          {/* IPC Guardrail */}
          <rect x="290" y="50" width="220" height="120" rx="10" fill="#18181b" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="310" y="85" fill="#fbbf24" fontSize="14" fontWeight="600">Guardrail &amp; IPC Bridge</text>
          <text x="310" y="110" fill="#a1a1aa" fontSize="12">Detección de rm -rf / git reset</text>
          <text x="310" y="130" fill="#34d399" fontSize="12">✓ Confirmación de usuario</text>

          {/* Main Process */}
          <rect x="560" y="50" width="200" height="120" rx="10" fill="#18181b" stroke="#10b981" strokeWidth="1" />
          <text x="580" y="85" fill="#34d399" fontSize="14" fontWeight="600">Main Process (PTY)</text>
          <text x="580" y="110" fill="#a1a1aa" fontSize="12">Node.js node-pty</text>
          <text x="580" y="130" fill="#a1a1aa" fontSize="12">PowerShell / Zsh / Bash</text>

          {/* Connections */}
          <path d="M240 110 L290 110" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />
          <path d="M510 110 L560 110" stroke="#10b981" strokeWidth="2" />
        </svg>
      </DiagramEmbed>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-5">
          <TerminalSquare className="mb-4 size-5 text-amber-300" strokeWidth={1.6} />
          <h3 className="font-medium text-white">Pseudo-Terminal (PTY)</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Soporta sesiones interactivas, colores ANSI completos y piping de procesos de larga duración.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-5">
          <ShieldCheck className="mb-4 size-5 text-emerald-400" strokeWidth={1.6} />
          <h3 className="font-medium text-white">Análisis de Destructividad</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Los comandos que modifican archivos críticos o eliminan directorios requieren confirmación explícita.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-5">
          <Lock className="mb-4 size-5 text-blue-400" strokeWidth={1.6} />
          <h3 className="font-medium text-white">Aislamiento por Directorio</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            El entorno de ejecución queda acotado al workspace activo seleccionado por el usuario.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <p className="mb-3 text-sm font-medium text-zinc-400">Ejemplo de comando ejecutado en segundo plano:</p>
        <CodeBlock command="pnpm --filter ia-sparta-terminal test:pty\n# Ejecución con streaming de salida en tiempo real" title="terminal-ipc" />
      </div>

      <SectionCta />
    </section>
  );
}
