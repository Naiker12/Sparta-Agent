import React, { useState, useEffect } from 'react';
import { SectionHeader } from '../ui/section-header';
import {
  ShieldAlert,
  Terminal,
  Activity,
  Workflow,
  GitBranch,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  NotionIcon,
  OneDriveIcon,
  SupabaseIcon,
} from '../icons/mcp-brand-icons';

export function AgentFlow() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const steps = [
    {
      id: 'input',
      title: 'Tarea Usuario',
      actor: 'user_prompt',
      node: 'User Input',
      stepNum: '01',
      desc: 'El usuario ingresa la solicitud en lenguaje natural en el IDE ("Implementa autenticación JWT con FastAPI...").',
      badge: 'Entrada Usuario',
      badgeColor: 'border-sky-500/30 text-sky-400 bg-sky-500/10',
      icon: NotionIcon,
      logs: [
        'Connecting to local IPC bridge: channel "chat:send-message"...',
        'Payload: { prompt: "Implementa autenticación JWT...", mode: "AGENT" }',
        'State initialized: { status: "INIT", depth: 0, retries: 0 }',
      ],
      stateVars: {
        status: 'USER_INPUT',
        current_node: 'user_prompt',
        active_tools: ['read_file', 'grep_search'],
        permission: 'AGENT_MODE',
      },
    },
    {
      id: 'planner',
      title: 'Plan Dinámico',
      actor: 'planner_node',
      node: 'create_plan',
      stepNum: '02',
      desc: 'El agente inspecciona el workspace y genera un plan estructurado en Markdown (`task.md`).',
      badge: 'Plan Estructurado',
      badgeColor: 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10',
      icon: NotionIcon,
      logs: [
        'Inspecting local repository files (14 matches found)...',
        'Writing plan draft to workspace task.md...',
        'Plan generated successfully. Awaiting execution approval.',
      ],
      stateVars: {
        status: 'PLANNING',
        current_node: 'planner_node',
        plan_created: true,
        permission: 'PLAN_MODE',
      },
    },
    {
      id: 'llm',
      title: 'Razonamiento',
      actor: 'agent_node',
      node: 'LLM Invocation',
      stepNum: '03',
      desc: 'El orquestador invoca el modelo configurado (z-ai/glm-5.2). Decide herramientas usando RAG local.',
      badge: 'Razonamiento Local',
      badgeColor: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
      icon: SupabaseIcon,
      logs: [
        'Querying ChromaDB local vector store for auth patterns...',
        'Invoking model via JSON-RPC stream...',
        'Model decided tool_call: write_to_file("src/auth.py", ...)',
      ],
      stateVars: {
        status: 'THINKING',
        current_node: 'agent_node',
        vector_hits: 8,
        selected_model: 'z-ai/glm-5.2',
      },
    },
    {
      id: 'sandbox',
      title: 'Broker Seguridad',
      actor: 'security_broker',
      node: 'CommandSanitizer',
      stepNum: '04',
      desc: 'El broker de seguridad intercepta la llamada I/O. Valida el Sanitizer y los límites del PathGuard.',
      badge: 'Security Shield',
      badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
      icon: ShieldAlert,
      logs: [
        'Security Interceptor: Intercepted write_file() payload.',
        'PathGuard: Target path inside workspace boundary. ALLOWED.',
        'CommandSanitizer: 0 policy violations detected.',
      ],
      stateVars: {
        status: 'SECURITY_CHECK',
        current_node: 'security_broker',
        path_guard: 'PASSED',
        sanitizer_violations: 0,
      },
    },
    {
      id: 'reflection',
      title: 'Auto-Corrección',
      actor: 'reflection_node',
      node: 'Auto-Reflection',
      stepNum: '05',
      desc: 'Ejecuta tsc/pytest/ruff. Si el linter falla, el agente analiza el traceback y auto-corrige el código.',
      badge: 'Self-Healing Loop',
      badgeColor: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
      icon: GitBranch,
      logs: [
        'Executing local test harness: pytest tests/auth...',
        'Linter Alert: 1 compilation error caught (tsc / ruff).',
        'Auto-Reflection: Analyzing traceback... Patching error (Retry 1/3).',
      ],
      stateVars: {
        status: 'REFLECTING',
        current_node: 'reflection_node',
        linter_errors: 1,
        auto_healed: true,
      },
    },
    {
      id: 'completion',
      title: 'Éxito Verificado',
      actor: 'END',
      node: 'Completion',
      stepNum: '06',
      desc: 'Una vez validadas todas las tareas sin errores, el agente termina y entrega el reporte con resumen.',
      badge: 'Éxito Verificado',
      badgeColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
      icon: OneDriveIcon,
      logs: [
        'Re-running tests: 14/14 checks passed (100% OK).',
        'Writing walkthrough.md verification report...',
        'Graph execution completed successfully in [AGENT MODE].',
      ],
      stateVars: {
        status: 'FINISHED',
        current_node: 'END',
        tests_passed: '14/14',
        walkthrough_saved: true,
      },
    },
  ];

  // Automatic continuous simulation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [steps.length]);

  const currentStep = steps[activeStepIndex];
  const StepIcon = currentStep.icon;

  return (
    <section id="flujo-agentico" className="py-16 relative overflow-hidden max-w-full bg-white dark:bg-[#09090b] text-slate-900 dark:text-white border-y border-slate-200 dark:border-white/10 font-sans transition-colors duration-300">
      {/* Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] max-w-[100vw] h-[350px] bg-[#18181b]/10 blur-[140px] pointer-events-none" />

      <div className="mx-auto max-w-7xl border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <SectionHeader
          eyebrow="LANGGRAPH ENGINE // GRAFO AUTÓNOMO"
          title="Cómo Piensa y Opera el Agente en Vivo"
          description="A diferencia de los asistentes convencionales, Sparta Agent ejecuta un grafo de estados determinista con auditoría en tiempo real."
        />

        {/* THIN ULTRA-SLEEK STEPPER TAB BAR (6 STEP NODES - HIGH DENSITY HORIZONTAL SLIM) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-10 mb-6">
          {steps.map((step, idx) => {
            const isActive = activeStepIndex === idx;
            const Icon = step.icon;
            return (
              <motion.div
                key={step.id}
                onClick={() => setActiveStepIndex(idx)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-3 py-2.5 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-between relative overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-r from-[#18181b] to-[#27272a] border-[#18181b] text-white shadow-lg shadow-[#18181b]/30 scale-[1.03]'
                    : 'bg-white dark:bg-[#18181b]/70 border-slate-200 dark:border-white/10 hover:border-[#18181b]/40 hover:bg-zinc-50/40 dark:hover:bg-white/[0.04]'
                }`}
              >
                {/* Active Step Top Progress Line */}
                {isActive && (
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3, ease: 'linear' }}
                    className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-[#f66e60] to-emerald-400"
                  />
                )}

                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded-md shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-gray-300'
                  }`}>
                    {step.stepNum}
                  </span>
                  <div className="overflow-hidden">
                    <h4 className={`text-[11px] font-bold truncate leading-none ${
                      isActive ? 'text-white' : 'text-slate-900 dark:text-white'
                    }`}>{step.title}</h4>
                    <span className={`text-[9px] font-mono block truncate mt-0.5 ${
                      isActive ? 'text-zinc-200' : 'text-slate-500 dark:text-gray-400'
                    }`}>
                      {step.actor}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 ml-1">
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white animate-pulse' : 'text-slate-400 dark:text-gray-400'}`} />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* MAIN DUAL DISPLAY PANELS - HIGH DENSITY COMPACT BALANCED (Min Height 310px) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Panel: Step Details & Explanation (6 Cols) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.25 }}
              className="lg:col-span-6 bg-white dark:bg-[#18181b]/90 border border-slate-200 dark:border-white/10 rounded-2xl p-5 backdrop-blur-xl flex flex-col justify-between relative overflow-hidden min-h-[310px] shadow-sm dark:shadow-none"
            >
              <div>
                <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#18181b]/20 border border-[#18181b]/40 flex items-center justify-center shrink-0">
                      <StepIcon className="w-5 h-5 text-[#52525b]" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-[#52525b] block font-semibold">
                        NODO DE GRAFO #{currentStep.stepNum}
                      </span>
                      <h3 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">{currentStep.title}</h3>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${currentStep.badgeColor}`}>
                    {currentStep.badge}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed mb-4">
                  {currentStep.desc}
                </p>

                {/* Compact State Variables Inspection Box */}
                <div className="bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 rounded-xl p-3 font-mono text-xs space-y-1.5 mb-2">
                  <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 pb-1.5 border-b border-slate-200 dark:border-white/10 text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-900 dark:text-white font-semibold">
                      <Activity className="w-3 h-3 text-[#52525b]" />
                      Estado del Grafo (State Object)
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">MEMORY_ACTIVE</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                    {Object.entries(currentStep.stateVars).map(([key, val]) => (
                      <div key={key} className="bg-white dark:bg-white/[0.03] p-1.5 rounded-lg border border-slate-200 dark:border-white/5 truncate">
                        <span className="text-slate-500 dark:text-gray-400 block text-[9px]">{key}</span>
                        <span className="text-slate-900 dark:text-white font-bold truncate block">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1 border-t border-slate-200 pt-3 font-mono text-[11px] text-slate-500 dark:border-white/10 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                <span>Actor: <strong className="text-slate-900 dark:text-white">{currentStep.actor}</strong></span>
                <span>Proceso: <strong className="text-[#52525b]">IPC TypeScript Native</strong></span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Right Panel: Live Sleek Terminal Console Stream (6 Cols) */}
          <div className="lg:col-span-6 bg-[#09090b] border border-white/15 rounded-2xl p-5 backdrop-blur-xl flex flex-col justify-between shadow-2xl relative min-h-[310px]">
            <div>
              {/* Console Header */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[#52525b]" />
                  <span className="max-w-[13rem] truncate text-[11px] font-bold text-white">SPARTA ENGINE CONSOLE v0.2.8</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-emerald-400 text-[10px] font-bold">STREAMING LOGS</span>
                </div>
              </div>

              {/* Single Continuous Sleek IDE Terminal Window */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="bg-[#111113] border border-white/10 rounded-xl p-3.5 font-mono text-xs space-y-2 mb-4"
                >
                  {currentStep.logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-gray-300 leading-relaxed text-[11px]">
                      <span className="text-[#52525b] font-bold select-none shrink-0">sparta@engine:~$</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Terminal Footer Status Bar */}
            <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#09090b] p-3 font-mono text-[11px] text-gray-300 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <Workflow className="w-3.5 h-3.5 text-[#3b82f6]" />
                Nodo Activo: <span className="text-white font-bold">{currentStep.node}</span>
              </span>
              <span className="text-[#10b981] font-bold">0 ERRORES</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
