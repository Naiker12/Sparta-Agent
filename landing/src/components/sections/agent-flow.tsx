import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { SectionHeader } from '../ui/section-header';
import {
  User,
  FileText,
  Bot,
  RotateCcw,
  CheckCircle,
  Play,
  ShieldAlert,
  Clock,
  Terminal,
  Activity,
  Workflow
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function AgentFlow() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const steps = [
    {
      id: 'input',
      title: 'Tarea del Usuario',
      actor: 'user_prompt',
      node: 'User Input',
      stepNum: '01',
      desc: 'El usuario solicita una tarea en lenguaje natural en el IDE local ("Implementa autenticación JWT con FastAPI y prueba los endpoints").',
      badge: 'Entrada del Usuario',
      badgeVariant: 'outline' as const,
      icon: User,
      logs: [
        'Connecting to local Electron IPC broker...',
        'Payload: "Implementa autenticación JWT con FastAPI..."',
        'State initialized: { status: "INIT", depth: 0 }'
      ]
    },
    {
      id: 'planner',
      title: 'Planificación Dinámica',
      actor: 'planner_node',
      node: 'create_plan',
      stepNum: '02',
      desc: 'El agente analiza el espacio de trabajo local y genera un plan atómico en Markdown (`task.md`). Nada se ejecuta a ciegas.',
      badge: 'Plan Estructurado',
      badgeVariant: 'accent' as const,
      icon: FileText,
      logs: [
        'Reading local repository files (14 matches)...',
        'Writing plan draft to workspace task.md...',
        'Plan generated. Awaiting local workspace execution check.'
      ]
    },
    {
      id: 'llm',
      title: 'Razonamiento Autónomo',
      actor: 'agent_node',
      node: 'LLM Invocation',
      stepNum: '03',
      desc: 'El orquestador invoca el modelo seleccionado (Ollama local o Cloud). El agente decide qué herramientas utilizar y lee de ChromaDB.',
      badge: 'Razonamiento Local',
      badgeVariant: 'default' as const,
      icon: Bot,
      logs: [
        'Querying ChromaDB local vector store...',
        'Invoking Llama 3 (Ollama local) via JSON-RPC...',
        'Model decided tool_call: write_file("src/auth.py", ...)'
      ]
    },
    {
      id: 'sandbox',
      title: 'Broker de Seguridad Rust',
      actor: 'security_broker',
      node: 'CommandSanitizer',
      stepNum: '04',
      desc: 'El broker nativo escrito en Rust intercepta la acción. Comprueba el sanitizer de comandos y valida el PathGuard en microsegundos.',
      badge: 'Security Shield',
      badgeVariant: 'warning' as const,
      icon: ShieldAlert,
      logs: [
        'Rust NAPI Interceptor: Hooked write_file context.',
        'PathGuard: Target path inside workspace boundary. ALLOWED.',
        'CommandSanitizer: 0 policy violations detected.'
      ]
    },
    {
      id: 'reflection',
      title: 'Auto-Corrección y Linters',
      actor: 'reflection_node',
      node: 'Auto-Reflection',
      stepNum: '05',
      desc: 'Ejecuta tsc/pytest/ruff en la máquina. Si el linter falla, el agente analiza el linter traceback y corrige el archivo.',
      badge: 'Self-Healing Loop',
      badgeVariant: 'secondary' as const,
      icon: RotateCcw,
      logs: [
        'Executing local test harness: pytest tests/auth...',
        'Linter Alert: 1 compilation error caught (tsc / ruff).',
        'Auto-Reflection: Analyzing traceback... Patching error (Retry 1/3).'
      ]
    },
    {
      id: 'completion',
      title: 'Finalización Verificada',
      actor: 'END',
      node: 'Completion',
      stepNum: '06',
      desc: 'Una vez completadas todas las sub-tareas del plan sin errores ni lints, el agente termina y muestra un resumen detallado.',
      badge: 'Éxito Verificado',
      badgeVariant: 'success' as const,
      icon: CheckCircle,
      logs: [
        'Rerunning tests: all checks passed (100% OK).',
        'Writing walkthrough.md verification log...',
        'Graph execution completed successfully in [BUILD MODE].'
      ]
    },
  ];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % steps.length);
    }, 4200);
    return () => clearInterval(interval);
  }, [isPlaying, steps.length]);

  const currentStep = steps[activeStepIndex];

  return (
    <section id="flujo-agentico" className="py-24 md:py-32 relative bg-transparent border-y border-[rgba(186,215,247,0.12)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Unified Section Header */}
        <SectionHeader
          eyebrow="LANGGRAPH ENGINE // GRAFO AUTÓNOMO"
          title="Cómo Piensa y Opera el Agente en Vivo"
          description="A diferencia de los asistentes de una sola pasada, Sparta Agent ejecuta un grafo de estados determinista. Todo el razonamiento y los planes son 100% transparentes."
        />

        {/* Premium Segmented Card Stepper (No loose connecting lines) */}
        <div className="relative mb-12 max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 relative z-10">
            {steps.map((st, idx) => {
              const IconComp = st.icon;
              const isActive = idx === activeStepIndex;
              const isCompleted = idx < activeStepIndex;
              
              return (
                <div
                  key={st.id}
                  onClick={() => {
                    setActiveStepIndex(idx);
                    setIsPlaying(false);
                  }}
                  className={`relative p-4 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col justify-between select-none h-[100px] ${
                    isActive
                      ? 'bg-[rgba(102,58,243,0.05)] border-[#663af3] shadow-[0_8px_24px_rgba(102,58,243,0.12)] scale-[1.02]'
                      : isCompleted
                      ? 'bg-[rgba(186,214,247,0.03)] border-[rgba(186,215,247,0.12)] opacity-85 hover:opacity-100 hover:border-[rgba(186,215,247,0.24)]'
                      : 'bg-[rgba(186,214,247,0.01)] border-[rgba(186,215,247,0.06)] opacity-60 hover:opacity-100 hover:border-[rgba(186,215,247,0.15)]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[10px] font-mono tracking-wider ${
                      isActive ? 'text-[#b6d9fc] font-bold' : 'text-[#9da7ba]'
                    }`}>
                      0{idx + 1}
                    </span>
                    <IconComp className={`w-4 h-4 transition-transform duration-300 ${
                      isActive ? 'text-[#b6d9fc] scale-110' : isCompleted ? 'text-indigo-400/80' : 'text-[#9da7ba]'
                    }`} />
                  </div>

                  <div className="space-y-1 mt-auto">
                    <div className={`text-xs font-mono truncate ${
                      isActive ? 'text-white font-bold' : 'text-[#c7d3ea]'
                    }`}>
                      {st.node}
                    </div>
                    <div className="text-[9px] font-mono text-[#9da7ba] truncate">
                      {st.title}
                    </div>
                  </div>

                  {/* Active bottom loading bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl overflow-hidden bg-transparent">
                    {isActive ? (
                      <motion.div 
                        className="h-full bg-gradient-to-r from-[#663af3] via-[#b6d9fc] to-[#663af3]"
                        layoutId="activeTimelineBar"
                        transition={{ duration: 0.3 }}
                      />
                    ) : isCompleted ? (
                      <div className="h-full bg-[#663af3]/45" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive Masterpiece Inspection Panel (Asymmetric 2-Column Grid) */}
        <div className="max-w-5xl mx-auto relative">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStepIndex}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="border border-[rgba(186,215,247,0.12)] bg-[rgba(5,6,15,0.97)] p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-2xl grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
                
                {/* COLUMN 1: Visual State Machine Graph Inspector (Col 5) */}
                <div className="md:col-span-5 bg-black/40 rounded-[12px] p-6 border border-[rgba(186,215,247,0.06)] flex flex-col justify-between relative min-h-[300px] overflow-hidden select-none">
                  
                  {/* Subtle decorative grid lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                  <div className="flex items-center justify-between z-10 pb-2 border-b border-[rgba(186,215,247,0.06)]">
                    <span className="text-[10px] font-mono text-[#b6d9fc] tracking-wider uppercase flex items-center gap-1.5">
                      <Workflow className="w-3.5 h-3.5 text-indigo-400" /> Graph Visualizer
                    </span>
                    <span className="text-[9px] font-mono text-[#9da7ba]">active: {currentStep.id}</span>
                  </div>

                  {/* Flow Diagram Rendering */}
                  <div className="flex-1 flex flex-col justify-center items-center gap-4 py-6 relative z-10 font-mono text-[10px]">
                    
                    {/* Visual representation of nodes */}
                    <div className="flex flex-col gap-3 w-full max-w-[200px]">
                      
                      {/* Node: User Input */}
                      <div className={`p-2 rounded-[6px] border text-center transition-all ${
                        activeStepIndex === 0 
                          ? 'bg-[#663af3] border-[#663af3] text-white font-bold shadow-md shadow-[#663af3]/20 scale-105' 
                          : 'bg-black/30 border-[rgba(186,215,247,0.08)] text-[#9da7ba]'
                      }`}>
                        ➔ User Input
                      </div>

                      {/* Node: Planner */}
                      <div className={`p-2 rounded-[6px] border text-center transition-all ${
                        activeStepIndex === 1 
                          ? 'bg-[#663af3] border-[#663af3] text-white font-bold shadow-md shadow-[#663af3]/20 scale-105' 
                          : 'bg-black/30 border-[rgba(186,215,247,0.08)] text-[#9da7ba]'
                      }`}>
                        ➔ create_plan (Markdown)
                      </div>

                      {/* Node: LLM Reasoning */}
                      <div className={`p-2 rounded-[6px] border text-center transition-all ${
                        activeStepIndex === 2 
                          ? 'bg-[#663af3] border-[#663af3] text-white font-bold shadow-md shadow-[#663af3]/20 scale-105' 
                          : 'bg-black/30 border-[rgba(186,215,247,0.08)] text-[#9da7ba]'
                      }`}>
                        ➔ LLM Agent Reasoning
                      </div>

                      {/* Node: Security Broker */}
                      <div className={`p-2 rounded-[6px] border text-center transition-all ${
                        activeStepIndex === 3 
                          ? 'bg-[#663af3] border-[#663af3] text-white font-bold shadow-md shadow-[#663af3]/20 scale-105' 
                          : 'bg-black/30 border-[rgba(186,215,247,0.08)] text-[#9da7ba]'
                      }`}>
                        ➔ Rust Security Sandbox
                      </div>

                      {/* Node: Reflection Loop */}
                      <div className={`p-2 rounded-[6px] border text-center transition-all ${
                        activeStepIndex === 4 
                          ? 'bg-[#663af3] border-[#663af3] text-white font-bold shadow-md shadow-[#663af3]/20 scale-105' 
                          : 'bg-black/30 border-[rgba(186,215,247,0.08)] text-[#9da7ba]'
                      }`}>
                        ➔ Linter Auto-Reflection
                      </div>

                      {/* Node: Done */}
                      <div className={`p-2 rounded-[6px] border text-center transition-all ${
                        activeStepIndex === 5 
                          ? 'bg-[#663af3] border-[#663af3] text-white font-bold shadow-md shadow-[#663af3]/20 scale-105' 
                          : 'bg-black/30 border-[rgba(186,215,247,0.08)] text-[#9da7ba]'
                      }`}>
                        ➔ END (Task Completed)
                      </div>

                    </div>

                  </div>

                  <div className="text-[9px] font-mono text-[#9da7ba] flex items-center justify-between border-t border-[rgba(186,215,247,0.06)] pt-2.5">
                    <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-[#34d399] animate-pulse" /> sidecar active</span>
                    <span>Ollama / LangGraph</span>
                  </div>
                </div>

                {/* COLUMN 2: Node Detail Info & Live Log Streaming (Col 7) */}
                <div className="md:col-span-7 flex flex-col justify-between space-y-6">
                  
                  {/* Top: Metadata & Play/Pause Controls */}
                  <div className="flex items-center justify-between pb-3 border-b border-[rgba(186,215,247,0.08)]">
                    <div className="flex items-center gap-3">
                      <Badge variant={currentStep.badgeVariant} className="px-2.5 py-0.5 rounded-[4px]">{currentStep.badge}</Badge>
                      <span className="font-mono text-[10px] text-[#9da7ba]">node: {currentStep.actor}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="h-8 gap-2 text-[10px] font-mono rounded-full border-[rgba(186,215,247,0.12)] hover:bg-[rgba(186,214,247,0.08)]"
                    >
                      {isPlaying ? <Clock className="w-3.5 h-3.5 text-indigo-400" /> : <Play className="w-3.5 h-3.5 text-indigo-400" />}
                      <span>{isPlaying ? 'Pausar' : 'Reanudar'}</span>
                    </Button>
                  </div>

                  {/* Middle: Title & Explanation */}
                  <div className="space-y-3">
                    <div className="text-[11px] font-mono text-[#b6d9fc] tracking-widest uppercase">Paso {currentStep.stepNum} del Flujo</div>
                    <h3 className="text-xl sm:text-2xl font-bold font-display text-[#d8ecf8] tracking-tight">
                      {currentStep.title}
                    </h3>
                    <p className="text-sm text-[#c7d3ea] leading-relaxed">
                      {currentStep.desc}
                    </p>
                  </div>

                  {/* Bottom: Simulated Live Terminal Log Stream */}
                  <div className="p-4 rounded-[12px] bg-[#05060f] border border-[rgba(186,215,247,0.08)] font-mono text-xs space-y-2.5 shadow-inner">
                    <div className="text-emerald-400 font-semibold flex items-center justify-between pb-1 border-b border-[rgba(255,255,255,0.03)]">
                      <span className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /> Terminal Execution Log</span>
                      <span className="text-[#9da7ba] text-[10px]">step {activeStepIndex + 1}/6</span>
                    </div>
                    <div className="space-y-1 text-[#9da7ba] text-[11px] leading-relaxed">
                      {currentStep.logs.map((log, lIdx) => (
                        <div key={lIdx} className="flex items-start gap-1.5">
                          <span className="text-indigo-400/80 select-none">&gt;</span>
                          <span className="truncate">{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}
