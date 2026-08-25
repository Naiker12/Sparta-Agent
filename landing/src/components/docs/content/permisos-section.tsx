import { BookOpen, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';
import { DiagramEmbed } from '../diagrams/diagram-embed';
import { getPublicUrl } from '@/lib/utils';

export function PermisosSection() {
  const screenshot = getPublicUrl('proyecto/Permisos antes de las acciones sensibles.png');

  return (
    <section id="seguridad" className="max-w-4xl">
      <SectionHeader
        eyebrow="Seguridad"
        title="La ejecución sensible no queda oculta"
        description="El puente IPC de Sparta Agent incorpora validación de rutas, análisis de comandos destructivos y un sistema de permisos interactivo. Cada acción con impacto en tu sistema requiere tu consentimiento explícito."
      />

      <DiagramEmbed caption="Figura 6: Matriz de control de seguridad y diálogo modal de permisos">
        <svg viewBox="0 0 800 200" className="w-full h-auto text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="200" rx="12" fill="#09090b" />

          {/* Action Requested */}
          <rect x="30" y="50" width="180" height="100" rx="10" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
          <text x="50" y="85" fill="#f4f4f5" fontSize="13" fontWeight="600">Acción Solicitada</text>
          <text x="50" y="108" fill="#a1a1aa" fontSize="11">• Escritura de archivo</text>
          <text x="50" y="125" fill="#a1a1aa" fontSize="11">• Comando terminal</text>

          {/* Guardrail Check */}
          <rect x="250" y="50" width="200" height="100" rx="10" fill="#18181b" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="270" y="85" fill="#fbbf24" fontSize="13" fontWeight="600">Análisis de Riesgo</text>
          <text x="270" y="108" fill="#a1a1aa" fontSize="11">• Fuera del workspace?</text>
          <text x="270" y="125" fill="#a1a1aa" fontSize="11">• Comando destructivo?</text>

          {/* Permission Dialog */}
          <rect x="490" y="50" width="280" height="100" rx="10" fill="#18181b" stroke="#10b981" strokeWidth="1.5" />
          <text x="510" y="85" fill="#34d399" fontSize="13" fontWeight="600">Diálogo de Permisos (Modal)</text>
          <text x="510" y="108" fill="#a1a1aa" fontSize="11">• Vista previa del cambio / comando</text>
          <text x="510" y="125" fill="#34d399" fontSize="11">✓ Permitir una vez / Permitir siempre</text>

          <path d="M210 100 L250 100" stroke="#f59e0b" strokeWidth="2" />
          <path d="M450 100 L490 100" stroke="#10b981" strokeWidth="2" />
        </svg>
      </DiagramEmbed>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-7 sm:p-9">
        <div className="flex items-start gap-4">
          <div className="rounded-lg border border-white/10 bg-zinc-950 p-2.5 text-amber-300">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Seguridad por diseño</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Cero ejecución a ciegas
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
              Las operaciones sensibles se comunican mediante contratos IPC estrictos. El agente nunca tiene acceso no supervisado a rutas fuera de tus proyectos habilitados.
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-zinc-950 p-5">
            <KeyRound className="size-5 text-amber-300" />
            <h3 className="mt-4 font-medium text-white">Credenciales aisladas</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              El paquete Vault y el administrador de claves separan el manejo de tokens del chat y el agente.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-950 p-5">
            <BookOpen className="size-5 text-emerald-400" />
            <h3 className="mt-4 font-medium text-white">Decisiones visibles</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Cada tool call y comando de consola queda registrado con timestamps y estado en el registro de auditoría.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-sm">
        <img
          src={screenshot}
          alt="Diálogo modal de confirmación de permisos en Sparta Agent"
          className="aspect-[16/9] w-full rounded-xl object-cover object-top"
        />
      </div>

      <SectionCta />
    </section>
  );
}
