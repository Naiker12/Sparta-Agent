import { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { SectionHeader } from '../ui/section-header';
import { ShieldCheck, DollarSign, Eye, Edit3 } from 'lucide-react';

export function ValueProps() {
  const [policyMode, setPolicyMode] = useState<'PLAN' | 'BUILD'>('BUILD');
  const [selectedModel, setSelectedModel] = useState<'Ollama' | 'Claude' | 'Gemini'>('Ollama');

  return (
    <section id="pilares" className="py-20 relative bg-[#09090b] border-y border-white/10">
      <div className="mx-auto max-w-7xl border-x border-white/10 px-4 sm:px-6 lg:px-8">
        
        {/* Unified Section Header */}
        <SectionHeader
          eyebrow="PROPUESTA DE VALOR // BENTO GRID"
          title="Por qué Sparta Agent es diferente a un Copilot convencional"
          description="Diseñado desde cero para brindar autonomía real sin comprometer el control ni la privacidad."
        />

        {/* Bento Grid Layout (2x2 Asymmetric) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-12">
          
          {/* Box 1: Local-First Security Engine (Col 7) */}
          <Card className="lg:col-span-7 p-8 space-y-6 flex flex-col justify-between relative overflow-hidden group hover:border-[#18181b]/40 transition-all duration-300 bg-[#18181b]/90 border-white/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <Badge variant="success">Local-First Sandbox</Badge>
              </div>

              <h3 className="text-2xl font-bold font-display text-white">
                1. Privacidad y Compliance Total por Diseño
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                El broker de seguridad intercepta todas las llamadas I/O del sistema operativo. Tu código jamás abandona la máquina ni el perímetro corporativo sin tu autorización explícita.
              </p>

              {/* Interactive Permission Policy Switcher */}
              <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-gray-300 pb-2 border-b border-white/10">
                  <span>SELECCIONAR MODO DE PERMISO</span>
                  <span className="text-emerald-400 font-semibold">ACTIVO</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPolicyMode('PLAN')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      policyMode === 'PLAN'
                        ? 'bg-[#18181b] border-[#18181b] text-white font-bold shadow-lg shadow-[#18181b]/30'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Modo Chat (Lectura)</span>
                  </button>

                  <button
                    onClick={() => setPolicyMode('BUILD')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      policyMode === 'BUILD'
                        ? 'bg-[#18181b] border-[#18181b] text-white font-bold shadow-lg shadow-[#18181b]/30'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modo Agente (Escritura)</span>
                  </button>
                </div>

                <div className="text-[11px] text-gray-400 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                  {policyMode === 'PLAN'
                    ? '🔍 MODO CHAT: Solo lectura y consultas (`list`, `search`, `get`). Creaciones o ediciones bloqueadas por seguridad.'
                    : '⚡ MODO AGENTE: Modificación activa con confirmación previa vía Diálogo Modal de Permisos.'}
                </div>
              </div>
            </div>
          </Card>

          {/* Box 2: TCO Savings (Col 5) */}
          <Card className="lg:col-span-5 p-8 space-y-6 flex flex-col justify-between relative overflow-hidden group hover:border-[#52525b]/40 transition-all duration-300 bg-[#18181b]/90 border-white/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                  <DollarSign className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
                  Ahorro TCO -70%
                </span>
              </div>

              <h3 className="text-2xl font-bold font-display text-white">
                2. Modelo Híbrido: Cero Cuotas Innecesarias
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                Utiliza Ollama o modelos locales para tareas pesadas de indexado y reserva APIs en la nube solo para razonamiento complejo.
              </p>

              {/* Model Provider Simulator */}
              <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-gray-300 pb-2 border-b border-white/10">
                  <span>PROVEEDOR SELECCIONADO</span>
                  <span className="text-amber-400 font-semibold">{selectedModel}</span>
                </div>
                <div className="flex gap-2">
                  {(['Ollama', 'Claude', 'Gemini'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedModel(m)}
                      className={`flex-1 py-1.5 rounded-xl border text-[11px] cursor-pointer transition-all ${
                        selectedModel === m
                          ? 'bg-[#52525b] border-[#52525b] text-white font-bold'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

        </div>
      </div>
    </section>
  );
}
