import { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ShieldCheck, DollarSign, BrainCircuit, CheckCircle2, Sparkles, Terminal, Eye, Edit3 } from 'lucide-react';

export function ValueProps() {
  const [policyMode, setPolicyMode] = useState<'PLAN' | 'BUILD'>('BUILD');
  const [selectedModel, setSelectedModel] = useState<'Ollama' | 'Claude' | 'Gemini'>('Ollama');

  return (
    <section id="pilares" className="py-24 md:py-32 relative bg-[#05060f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header with AuthKit Flanked Eyebrow Divider */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="flex items-center justify-center gap-4 text-[#c7d3ea] font-mono text-[13px] tracking-[0.10em] uppercase">
            <div className="h-[1px] w-16 sm:w-24 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.2)] to-transparent" />
            <span>PROPUESTA DE VALOR // BENTO GRID</span>
            <div className="h-[1px] w-16 sm:w-24 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.2)] to-transparent" />
          </div>
          
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#d8ecf8] to-[#98c0ef]">
            Por qué Sparta Agent es diferente a un Copilot convencional
          </h2>
          <p className="text-base sm:text-lg text-[#c7d3ea] font-normal">
            Diseñado desde cero para brindar autonomía real sin comprometer el control ni la privacidad.
          </p>
        </div>

        {/* Bento Grid Layout (2x2 Asymmetric) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Box 1: Local-First Security Engine (Col 7) */}
          <Card className="lg:col-span-7 p-8 space-y-6 flex flex-col justify-between relative overflow-hidden group hover:border-[#663af3]/50 transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-full bg-[rgba(52,211,153,0.1)] text-[#34d399] border border-[rgba(52,211,153,0.2)]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <Badge variant="success">Local-First Sandbox</Badge>
              </div>

              <h3 className="text-2xl font-bold font-display text-[#d8ecf8]">
                1. Privacidad y Compliance Total por Diseño
              </h3>
              <p className="text-sm text-[#9da7ba] leading-relaxed">
                El broker de seguridad en Rust intercepta todas las llamadas I/O del sistema operativo. Tu código jamás abandona la máquina ni el perímetro corporativo sin tu autorización explícita.
              </p>

              {/* Interactive Permission Policy Switcher */}
              <div className="p-4 rounded-[12px] bg-[#080914] border border-[rgba(186,215,247,0.12)] space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-[#c7d3ea] pb-2 border-b border-[rgba(186,215,247,0.08)]">
                  <span>SELECCIONAR MODO DE PERMISO</span>
                  <span className="text-[#34d399] font-semibold">ACTIVO</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPolicyMode('PLAN')}
                    className={`p-3 rounded-full border text-left flex items-center justify-between transition-all cursor-pointer ${
                      policyMode === 'PLAN'
                        ? 'bg-[rgba(56,189,248,0.15)] border-[#38bdf8] text-[#38bdf8] font-bold'
                        : 'bg-[#05060f] border-[rgba(186,215,247,0.1)] text-[#9da7ba] hover:text-[#d1e4fa]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#38bdf8]" /> PLAN Mode
                    </span>
                    <span className="text-[10px] uppercase">Solo Lectura</span>
                  </button>

                  <button
                    onClick={() => setPolicyMode('BUILD')}
                    className={`p-3 rounded-full border text-left flex items-center justify-between transition-all cursor-pointer ${
                      policyMode === 'BUILD'
                        ? 'bg-[#663af3] border-[#663af3] text-white font-bold shadow-md shadow-[#663af3]/30'
                        : 'bg-[#05060f] border-[rgba(186,215,247,0.1)] text-[#9da7ba] hover:text-[#d1e4fa]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-white" /> BUILD Mode
                    </span>
                    <span className="text-[10px] uppercase">Escritura OK</span>
                  </button>
                </div>

                <div className="text-[11px] text-[#9da7ba] pt-2 flex items-center justify-between">
                  <span>CommandSanitizer: <strong className="text-[#34d399]">rm -rf / BLOQUEADO</strong></span>
                  <span>PathGuard: <strong className="text-[#34d399]">.env PROTEGIDO</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-[#34d399] pt-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Cumplimiento estricto GDPR / CCPA / HIPAA / Air-Gapped</span>
            </div>
          </Card>

          {/* Box 2: TCO & Multi-Model Flexibility (Col 5) */}
          <Card className="lg:col-span-5 p-8 space-y-6 flex flex-col justify-between relative overflow-hidden group hover:border-[#663af3]/50 transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-full bg-[rgba(102,58,243,0.15)] text-[#663af3] border border-[rgba(102,58,243,0.3)]">
                  <DollarSign className="w-6 h-6" />
                </div>
                <Badge variant="accent">TCO -70%</Badge>
              </div>

              <h3 className="text-2xl font-bold font-display text-[#d8ecf8]">
                2. Costo y Flexibilidad Multi-Modelo
              </h3>
              <p className="text-sm text-[#9da7ba] leading-relaxed">
                Orquesta automáticamente entre modelos locales ultrarrápidos (Ollama / Llama 3) para tareas de sintaxis y modelos Cloud premium para decisiones complejas.
              </p>

              {/* Model Switcher Pill Selector */}
              <div className="p-4 rounded-[12px] bg-[#080914] border border-[rgba(186,215,247,0.12)] space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-[#c7d3ea]">
                  <span>PROVEEDOR ACTIVO</span>
                  <span className="text-[#b6d9fc] font-semibold">LATENCIA</span>
                </div>

                <div className="flex gap-2">
                  {(['Ollama', 'Claude', 'Gemini'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedModel(m)}
                      className={`flex-1 p-2 rounded-full border text-center transition-all cursor-pointer ${
                        selectedModel === m
                          ? 'bg-[#663af3] text-white font-bold border-[#663af3]'
                          : 'bg-[#05060f] text-[#9da7ba] border-[rgba(186,215,247,0.1)] hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="p-3 rounded-[8px] bg-[#05060f] text-[#d1e4fa] flex items-center justify-between">
                  <span>{selectedModel === 'Ollama' ? 'Ollama Llama 3 (Local)' : selectedModel === 'Claude' ? 'Claude 3.5 Sonnet (Cloud)' : 'Gemini 1.5 Pro (Cloud)'}</span>
                  <span className="text-[#34d399] font-bold">{selectedModel === 'Ollama' ? '$0 / 12ms' : selectedModel === 'Claude' ? '$0.003 / 450ms' : '$0.001 / 320ms'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-[#b6d9fc] pt-2">
              <Sparkles className="w-4 h-4" />
              <span>Conmutación dinámica inteligente por complejidad</span>
            </div>
          </Card>

          {/* Box 3: Auto-Reflection & Continuous Linters (Col 12 - Full Width) */}
          <Card className="lg:col-span-12 p-8 md:p-10 space-y-6 relative overflow-hidden group hover:border-[#663af3]/50 transition-all duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-[rgba(168,85,247,0.15)] text-[#a855f7] border border-[rgba(168,85,247,0.3)]">
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <Badge variant="accent">LangGraph Reasoning</Badge>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold font-display text-[#d8ecf8]">
                  3. Autonomía Real con Auto-Corrección Continua
                </h3>
                <p className="text-base text-[#c7d3ea] leading-relaxed">
                  No es un autocompletado pasivo. Sparta Agent ejecuta el compilador y linter real del proyecto (<code className="font-mono text-xs text-[#b6d9fc]">tsc</code>, <code className="font-mono text-xs text-[#b6d9fc]">eslint</code>, <code className="font-mono text-xs text-[#b6d9fc]">ruff</code>, <code className="font-mono text-xs text-[#b6d9fc]">cargo</code>) tras cada edición. Si detecta un fallo, analiza el traceback y se auto-corrige.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs pt-2">
                  <div className="p-3 rounded-[8px] bg-[#080914] border border-[rgba(186,215,247,0.12)] flex items-center gap-2 text-[#d1e4fa]">
                    <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" /> Generación de planes en Markdown
                  </div>
                  <div className="p-3 rounded-[8px] bg-[#080914] border border-[rgba(186,215,247,0.12)] flex items-center gap-2 text-[#d1e4fa]">
                    <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" /> Reintentos de reflexión (hasta 3x)
                  </div>
                </div>
              </div>

              {/* Diagnostic Terminal Stream Box */}
              <div className="lg:col-span-5 bg-[#05060f] p-5 rounded-[12px] border border-[rgba(186,215,247,0.12)] font-mono text-xs space-y-3 shadow-inner">
                <div className="flex items-center justify-between pb-2 border-b border-[rgba(186,215,247,0.1)] text-[#9da7ba]">
                  <span className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[#a855f7]" /> AUTO-DIAGNOSTIC STREAM
                  </span>
                  <span className="text-[#34d399] font-semibold">REFLECT LOOP</span>
                </div>
                
                <div className="space-y-1.5 text-[#c7d3ea]">
                  <div className="text-[#fbbf24]">&gt; running tsc --noEmit</div>
                  <div className="text-[#f87171]">✖ Property &apos;user_id&apos; does not exist on type &apos;TokenData&apos;</div>
                  <div className="text-[#c084fc]">&gt; reflection_node: Analyzing traceback error...</div>
                  <div className="text-[#34d399]">✓ Patch generated: updated interface TokenData</div>
                  <div className="text-[#34d399]">✓ tsc check passed on retry 1/3</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
