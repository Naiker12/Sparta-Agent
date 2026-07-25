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
  Users,
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
      node: 'Planner',
      desc: 'Si la tarea es compleja, el planner analiza el workspace y genera un plan estructurado por pasos en Markdown visible para el usuario.',
      badge: 'Generación de Plan',
      badgeVariant: 'accent' as const,
      icon: FileText,
    },
    {
      id: 'agent',
      title: '3. Agente Principal',
      actor: 'agent node',
      node: 'Agent Core',
      desc: 'El agente procesa el contexto del código y decide qué herramientas invocar (ej. view_file, write_to_file, run_command).',
      badge: 'LLM Reasoning',
      badgeVariant: 'accent' as const,
      icon: Bot,
    },
    {
      id: 'tools',
      title: '4. Ejecución de Tools',
      actor: 'tools node',
      node: 'ToolNode',
      desc: 'El ToolNode ejecuta las herramientas bajo la supervisión del Security Broker en Rust. Máximo 8 invocaciones por turno.',
      badge: 'Rust Security Sandbox',
      badgeVariant: 'warning' as const,
      icon: Wrench,
    },
    {
      id: 'reflection',
      title: '5. Bucle de Auto-Reflexión',
      actor: 'reflection node',
      node: 'Reflection',
      desc: 'Si el compilador o linter falla (ej. tsc o pytest), el nodo de reflexión analiza los diagnósticos y ajusta el plan (máx. 3 reintentos).',
      badge: 'Auto-Corrección',
      badgeVariant: 'warning' as const,
      icon: RotateCcw,
    },
    {
      id: 'subagents',
      title: '6. Coordinación de Subagentes',
      actor: 'subagent_coordinator',
      node: 'Subagents',
      desc: 'Para tareas masivas, delega a subagentes aislados de research, código o memoria (profundidad ≤ 2, timeout 120s).',
      badge: 'Paralelismo',
      badgeVariant: 'accent' as const,
      icon: Users,
    },
    {
      id: 'end',
      title: '7. Verificación y Respuesta Final',
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
    <section id="flujo-agentico" className="py-20 md:py-28 relative bg-[var(--bg-surface)] border-y border-[var(--border-normal)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge variant="accent" className="px-3.5 py-1 text-xs uppercase font-mono tracking-wider">
            Signature Component · LangGraph Engine
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-[var(--text-display)]">
            Cómo Piensa y Opera el Agente en Vivo
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-secondary)]">
            A diferencia de los asistentes de una sola pasada, Sparta Agent ejecuta un grafo de estados determinista. Todo el razonamiento y los planes son 100% transparentes.
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-normal)] shadow-xs">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="gap-2 text-xs font-mono font-semibold"
            >
              {isPlaying ? <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-500" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pausar Simulación' : 'Reanudar Simulación'}</span>
            </Button>
            <span className="text-xs text-[var(--text-secondary)] font-mono font-medium hidden sm:inline">
              Paso actual: {activeStepIndex + 1} / {steps.length}
            </span>
          </div>

          {/* Boundaries Legend */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5 bg-[var(--bg-base)] px-3 py-1 rounded-md border border-[var(--border-normal)] font-medium">
              <Sliders className="w-3.5 h-3.5 text-indigo-500" /> Máx 8 tool calls/turno
            </span>
            <span className="flex items-center gap-1.5 bg-[var(--bg-base)] px-3 py-1 rounded-md border border-[var(--border-normal)] font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Máx 3 reintentos reflexión
            </span>
            <span className="flex items-center gap-1.5 bg-[var(--bg-base)] px-3 py-1 rounded-md border border-[var(--border-normal)] font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Subagentes ≤2 prof. / 120s timeout
            </span>
          </div>
        </div>

        {/* Interactive Flow Diagram Display */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Flow Steps Visual Map */}
          <div className="lg:col-span-7 space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeStepIndex;
              return (
                <div
                  key={step.id}
                  onClick={() => {
                    setActiveStepIndex(index);
                    setIsPlaying(false);
                  }}
                  className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-md shadow-indigo-500/10 dark:bg-indigo-500/20'
                      : 'border-[var(--border-normal)] bg-[var(--bg-base)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2.5 rounded-lg ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-[var(--text-display)]">
                          {step.title}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-sans">
                        {step.desc}
                      </p>
                    </div>
                  </div>

                  <Badge variant={step.badgeVariant} className="text-[10px]">
                    {step.badge}
                  </Badge>
                </div>
              );
            })}
          </div>

          {/* Detailed Inspector Panel */}
          <div className="lg:col-span-5">
            <Card className="border-[var(--border-strong)] bg-[var(--bg-elevated)] p-6 space-y-6 sticky top-28 shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--border-normal)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-500/15 text-indigo-500 border border-indigo-500/30">
                    <currentStep.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-display text-[var(--text-display)]">
                      {currentStep.title}
                    </h3>
                    <p className="text-xs font-mono text-[var(--text-secondary)]">Nodo: {currentStep.node}</p>
                  </div>
                </div>
                <Badge variant={currentStep.badgeVariant}>{currentStep.badge}</Badge>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase text-[var(--text-secondary)] font-bold tracking-wider">
                  DESCRIPCIÓN DE COMPORTAMIENTO
                </h4>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed font-sans">
                  {currentStep.desc}
                </p>
              </div>

              {/* Console Mock Simulation Log */}
              <div className="bg-[#0C0C10] p-4 rounded-xl border border-[var(--border-normal)] font-mono text-[11px] space-y-2 text-zinc-100">
                <div className="flex items-center justify-between text-zinc-400 pb-2 border-b border-zinc-800">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" /> LANGGRAPH STATE LOG
                  </span>
                  <span>turno: 1/8</span>
                </div>

                <div className="text-indigo-400 font-semibold">
                  &gt; StateGraph.invoke({'{'} action: &quot;{currentStep.id}&quot; {'}'})
                </div>

                {currentStep.id === 'planner' && (
                  <div className="text-emerald-400">
                    + plan.md generado con 4 pasos (verificable en UI)<br />
                    + modo_seguridad: BUILD (lectura/escritura)
                  </div>
                )}
                {currentStep.id === 'agent' && (
                  <div className="text-purple-300">
                    + LLM reasoning complete (145 ms)<br />
                    + tool_call solicitada: write_to_file(&quot;src/auth.py&quot;)
                  </div>
                )}
                {currentStep.id === 'tools' && (
                  <div className="text-amber-300">
                    + Rust CommandSanitizer check: OK<br />
                    + ToolNode ejecutado (28 ms)
                  </div>
                )}
                {currentStep.id === 'reflection' && (
                  <div className="text-rose-300">
                    + Linter error detectado: ruff E501<br />
                    + Auto-reflection triggered (intento 1/3)
                  </div>
                )}
                {currentStep.id === 'subagents' && (
                  <div className="text-cyan-300">
                    + Subagente research invocado (timeout 120s)<br />
                    + Profundidad: 1 (Límite max 2)
                  </div>
                )}
                {currentStep.id === 'end' && (
                  <div className="text-emerald-400 font-semibold">
                    ✓ Estado alcanzado: END<br />
                    ✓ Todos los tests unitarios pasados sin fallos
                  </div>
                )}
                {currentStep.id === 'input' && (
                  <div className="text-slate-300">
                    + Recibido prompt del usuario<br />
                    + Evaluando complejidad con heurística local
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
