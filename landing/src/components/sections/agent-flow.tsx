import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  User,
  FileText,
  Bot,
  Wrench,
  RotateCcw,
  CheckCircle,
  Play,
  RotateCw,
  Sliders,
  ShieldAlert,
  Clock,
  Terminal
} from 'lucide-react';

export function AgentFlow() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const steps = [
    {
      id: 'input',
      title: '1. Tarea del Usuario',
      actor: 'user_prompt',
      node: 'User Input',
      desc: 'El usuario solicita una tarea en lenguaje natural ("Implementa autenticación JWT con FastAPI y prueba los endpoints").',
      badge: 'Entrada',
      badgeVariant: 'outline' as const,
      icon: User,
    },
    {
      id: 'planner',
      title: '2. Planner (LangGraph Engine)',
      actor: 'planner node',
      node: 'create_plan',
      desc: 'El agente descompone la solicitud en pasos atómicos y genera un archivo de plan en Markdown para transparencia total.',
      badge: 'Plan Estructurado',
      badgeVariant: 'accent' as const,
      icon: FileText,
    },
    {
      id: 'llm',
      title: '3. LLM Reasoning (Multi-Vendor)',
      actor: 'agent node',
      node: 'LLM Invocation',
      desc: 'El modelo (Ollama local o Cloud API) razona qué herramientas invocar y valida el contexto con ChromaDB.',
      badge: 'Razonamiento',
      badgeVariant: 'default' as const,
      icon: Bot,
    },
    {
      id: 'sandbox',
      title: '4. Rust Security Broker',
      actor: 'security broker',
      node: 'CommandSanitizer',
      desc: 'El broker nativo en Rust intercepta la llamada. Si es una acción destructiva (ej. rm -rf), la detiene y solicita confirmación.',
      badge: 'Security Sandbox',
      badgeVariant: 'warning' as const,
      icon: ShieldAlert,
    },
    {
      id: 'reflection',
      title: '5. Auto-Reflexión y Linters',
      actor: 'reflection node',
      node: 'Auto-Reflection',
      desc: 'Ejecuta tsc/pytest/ruff. Si el linter detecta un fallo, captura el traceback y reintenta automáticamente (hasta 3 veces).',
      badge: 'Self-Healing',
      badgeVariant: 'secondary' as const,
      icon: RotateCcw,
    },
    {
      id: 'completion',
      title: '6. Finalización Verificada',
      actor: 'END',
      node: 'Completion',
      desc: 'Tras ejecutar los tests y confirmar el éxito sin advertencias silenciosas, entrega los cambios con el resumen completo.',
      badge: 'Éxito Verificado',
      badgeVariant: 'success' as const,
      icon: CheckCircle,
    },
  ];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % steps.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [isPlaying, steps.length]);

  const currentStep = steps[activeStepIndex];

  return (
    <section id="flujo-agentico" className="py-24 md:py-32 relative bg-[#05060f] border-y border-[rgba(186,215,247,0.12)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* AuthKit Flanked Eyebrow Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="flex items-center justify-center gap-4 text-[#c7d3ea] font-mono text-[13px] tracking-[0.10em] uppercase">
            <div className="h-[1px] w-16 sm:w-24 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.2)] to-transparent" />
            <span>LANGGRAPH ENGINE // GRAFO AUTÓNOMO</span>
            <div className="h-[1px] w-16 sm:w-24 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.2)] to-transparent" />
          </div>
          
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#d8ecf8] to-[#98c0ef]">
            Cómo Piensa y Opera el Agente en Vivo
          </h2>
          <p className="text-base sm:text-lg text-[#c7d3ea]">
            A diferencia de los asistentes de una sola pasada, Sparta Agent ejecuta un grafo de estados determinista. Todo el razonamiento y los planes son 100% transparentes.
          </p>
        </div>

        {/* AuthKit Feature Icon Row Timeline (6 Circular Tiles connected by 1px Hairline) */}
        <div className="relative mb-14">
          <div className="hidden lg:block absolute top-[28px] left-[60px] right-[60px] h-[1px] bg-[rgba(186,215,247,0.12)] -z-0" />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 relative z-10">
            {steps.map((st, idx) => {
              const IconComp = st.icon;
              const isActive = idx === activeStepIndex;
              return (
                <div
                  key={st.id}
                  onClick={() => {
                    setActiveStepIndex(idx);
                    setIsPlaying(false);
                  }}
                  className="flex flex-col items-center text-center cursor-pointer group"
                >
                  {/* AuthKit Circular Icon Container: 56px, 9999px radius */}
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 border ${
                      isActive
                        ? 'bg-[#663af3] text-white border-[#663af3] shadow-lg shadow-[#663af3]/40 scale-110'
                        : 'bg-[rgba(186,214,247,0.06)] text-[#d1e4fa] border-[rgba(186,215,247,0.12)] group-hover:border-[#663af3]/50'
                    }`}
                  >
                    <IconComp className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  
                  <span className="mt-3 text-xs font-mono text-[#c7d3ea] font-medium group-hover:text-white transition-colors">
                    {st.node}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Node Detail Glass Card */}
        <Card className="max-w-4xl mx-auto p-8 border border-[rgba(186,215,247,0.12)] bg-[rgba(5,6,15,0.97)] shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-[rgba(186,215,247,0.1)]">
            <div className="flex items-center gap-3">
              <Badge variant={currentStep.badgeVariant}>{currentStep.badge}</Badge>
              <span className="font-mono text-xs text-[#9da7ba]">actor: {currentStep.actor}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="gap-2 text-xs font-mono"
            >
              {isPlaying ? <Clock className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pausar Simulación' : 'Reanudar Simulación'}</span>
            </Button>
          </div>

          <div className="py-6 space-y-3">
            <h3 className="text-xl font-bold font-display text-[#d8ecf8]">
              {currentStep.title}
            </h3>
            <p className="text-sm text-[#c7d3ea] leading-relaxed">
              {currentStep.desc}
            </p>
          </div>

          {/* Terminal Output Log Bar */}
          <div className="p-4 rounded-[12px] bg-[#05060f] border border-[rgba(186,215,247,0.1)] font-mono text-xs space-y-1">
            <div className="text-[#34d399] font-semibold flex items-center justify-between">
              <span>&gt; LangGraph State Node: [{currentStep.node}]</span>
              <span className="text-[#9da7ba]">step {activeStepIndex + 1}/6</span>
            </div>
            <div className="text-[#9da7ba]">
              + Interceptor check: CommandSanitizer policy verified (0 violations)
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
