import { ShieldCheck, DollarSign, BrainCircuit, Check, Lock, Cpu, Sparkles, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useState } from 'react';

export function ValueProps() {
  const [activeTab, setActiveTab] = useState<'privacy' | 'tco' | 'autonomy'>('privacy');

  const pillars = [
    {
      id: 'privacy',
      icon: ShieldCheck,
      badge: 'Local-First',
      title: '1. Privacidad y Compliance Total',
      short: 'Tu código nunca abandona tu máquina ni el perímetro corporativo.',
      desc: 'Desarrollado para entornos bancarios y corporativos estrictos. El broker en Rust intercepta todas las llamadas I/O y asegura que ningún archivo confidencial (.env, .pem, llaves privadas) ni fragmento de código sea enviado a servidores externos no autorizados.',
      highlights: [
        'Cumplimiento estricto GDPR / CCPA / HIPAA',
        'Validación de sandbox con PathGuard y CommandSanitizer',
        'Cifrado en reposo para tokens de API y contexto vectorial',
        'Ejecución 100% offline opcional con Ollama / Llama 3',
      ],
      color: 'emerald',
    },
    {
      id: 'tco',
      icon: DollarSign,
      badge: 'TCO -70%',
      title: '2. Costo y Flexibilidad Multi-Modelo',
      short: 'Orquestación inteligente entre LLMs locales y modelos Cloud premium.',
      desc: 'No malgastes presupuesto enviando tareas triviales de sintaxis a modelos cloud costosos. Sparta Agent conmuta dinámicamente entre modelos locales rápidos para refactorización previa y modelos de alto razonamiento (Claude 3.5 Sonnet, Gemini 1.5 Pro) solo para planificación arquitectónica compleja.',
      highlights: [
        'Reducción drástica del gasto en tokens (hasta -70% TCO)',
        'Soporte nativo para Ollama, LM Studio, VLLM y vLLM local',
        'Integración sin fricción con Anthropic, OpenAI y Google Gemini',
        'Catálogo de proveedores configurable por el desarrollador',
      ],
      color: 'indigo',
    },
    {
      id: 'autonomy',
      icon: BrainCircuit,
      badge: 'LangGraph Engine',
      title: '3. Autonomía Real con Auto-Corrección',
      short: 'No es autocompletado pasivo — es un agente que planifica y refactoriza.',
      desc: 'El sidecar en Python impulsado por LangGraph opera en un bucle continuo de Plan → Act → Reflect. Si una herramienta falla o un linter detecta errores tras una modificación, el agente analiza el traceback, ajusta el plan y reintenta autónomamente.',
      highlights: [
        'Creación de planes de ejecución transparentes y legibles',
        'Validación automática con linters (tsc, eslint, ruff, mypy, cargo)',
        'Bucle de reflexión con hasta 3 reintentos guiados por diagnósticos',
        'Coordinación de subagentes de investigación y edición',
      ],
      color: 'purple',
    },
  ];

  const currentPillar = pillars.find((p) => p.id === activeTab)!;

  return (
    <section id="pilares" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge variant="default" className="text-xs uppercase font-mono tracking-wider">
            Propuesta de Valor
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-[var(--text-display)]">
            Por qué Sparta Agent es diferente a un Copilot convencional
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-secondary)]">
            Diseñado desde cero para resolver las tres barreras principales del desarrollo asistido por IA en la empresa.
          </p>
        </div>

        {/* Tab Buttons for Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            const isActive = activeTab === pillar.id;
            return (
              <button
                key={pillar.id}
                onClick={() => setActiveTab(pillar.id as any)}
                className={`p-6 rounded-2xl text-left border transition-all duration-300 relative cursor-pointer ${
                  isActive
                    ? 'bg-[var(--bg-elevated)] border-[var(--accent)] shadow-xl shadow-indigo-500/10 scale-[1.02]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-normal)] hover:border-[var(--border-strong)] opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`p-3 rounded-xl ${
                      isActive ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <Badge variant={isActive ? 'accent' : 'secondary'} className="text-[11px]">
                    {pillar.badge}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold font-display text-[var(--text-display)] mb-1">
                  {pillar.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  {pillar.short}
                </p>
              </button>
            );
          })}
        </div>

        {/* Pillar Detail View */}
        <Card className="border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 md:p-12 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2">
                <Badge variant="accent">{currentPillar.badge}</Badge>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold font-display text-[var(--text-display)]">
                {currentPillar.title}
              </h3>
              <p className="text-base text-[var(--text-secondary)] leading-relaxed">
                {currentPillar.desc}
              </p>

              <div className="space-y-3 pt-2">
                {currentPillar.highlights.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bg-[var(--bg-base)] p-6 rounded-xl border border-[var(--border-normal)] font-mono text-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                <span>ESTADO DEL NÚCLEO</span>
                <span className="text-emerald-400 font-bold">VERIFICADO</span>
              </div>
              <div className="space-y-2 text-[var(--text-secondary)]">
                <div className="flex justify-between">
                  <span>Modo de Permiso:</span>
                  <span className="text-[var(--accent)] font-semibold">PermissionPolicy.BUILD</span>
                </div>
                <div className="flex justify-between">
                  <span>Sanitizer Status:</span>
                  <span className="text-emerald-400">CommandSanitizer Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Orquestador:</span>
                  <span className="text-purple-400">LangGraph StateGraph</span>
                </div>
                <div className="flex justify-between">
                  <span>Memory Layer:</span>
                  <span className="text-amber-400">ChromaDB Vector Store</span>
                </div>
              </div>
              <div className="pt-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                $ sparta doctor --check-security<br />
                <span className="text-emerald-400">✓ Security Broker NAPI binding: ok</span><br />
                <span className="text-emerald-400">✓ Python Sidecar venv: active</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
