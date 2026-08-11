import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Cpu,
  Folder,
  GitBranch,
  Globe,
  Download,
  Zap,
  CheckCircle2,
  Lock,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
  Bot,
} from 'lucide-react';
import {
  NotionIcon,
  OneDriveIcon,
  GoogleDriveIcon,
  GmailIcon,
  GoogleCalendarIcon,
  SlackIcon,
  SupabaseIcon,
} from '../icons/mcp-brand-icons';

interface MCPToolItem {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  category: string;
}

const ALL_MCP_TOOLS: MCPToolItem[] = [
  { id: 'notion', name: 'Notion', icon: NotionIcon, color: '#a855f7', category: 'Productividad' },
  { id: 'onedrive', name: 'OneDrive', icon: OneDriveIcon, color: '#0078d4', category: 'Almacenamiento' },
  { id: 'gdrive', name: 'Google Drive', icon: GoogleDriveIcon, color: '#34a853', category: 'Almacenamiento' },
  { id: 'gmail', name: 'Gmail', icon: GmailIcon, color: '#ea4335', category: 'Productividad' },
  { id: 'gcal', name: 'Google Calendar', icon: GoogleCalendarIcon, color: '#4285f4', category: 'Productividad' },
  { id: 'fs', name: 'Filesystem', icon: Folder, color: '#10b981', category: 'DevTools' },
  { id: 'github', name: 'GitHub', icon: GitBranch, color: '#ec4899', category: 'DevTools' },
  { id: 'slack', name: 'Slack', icon: SlackIcon, color: '#e01e5a', category: 'Productividad' },
  { id: 'supabase', name: 'Supabase', icon: SupabaseIcon, color: '#3ecf8e', category: 'Bases de Datos' },
  { id: 'playwright', name: 'Playwright', icon: Globe, color: '#06b6d4', category: 'DevTools' },
  { id: 'fetch', name: 'Fetch Parser', icon: Download, color: '#f59e0b', category: 'DevTools' },
  { id: 'memory', name: 'Knowledge Graph', icon: Cpu, color: '#663af3', category: 'Memoria' },
];

export function McpGraphShowcase() {
  const [activeModel, setActiveModel] = useState('z-ai/glm-5.2');
  const [activeStep, setActiveStep] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? { initial: false, animate: { opacity: 1, y: 0 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  useEffect(() => {
    if (shouldReduceMotion) return;

    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 6);
    }, 2500);
    return () => clearInterval(timer);
  }, [shouldReduceMotion]);

  const workflowSteps = [
    { num: 1, text: 'Buscando espacio de trabajo en Notion...' },
    { num: 2, text: 'Leyendo archivo "Proyecto_2026.docx" en OneDrive...' },
    { num: 3, text: 'Formateando bloques nativos de Markdown (H2, listas)...' },
    { num: 4, text: 'Ejecutando llamada REST API directa (HTTP 200 OK)...' },
    { num: 5, text: 'Verificando firmas de autorización en Modo Agente...' },
    { num: 6, text: 'Generando reporte con resumen transparente de cambios...' },
  ];

  // Doubled array for seamless infinite marquee loop
  const marqueeTools = [...ALL_MCP_TOOLS, ...ALL_MCP_TOOLS];

  // Constellation satellite nodes setup
  const constellationSatellites = [
    { icon: NotionIcon, color: '#a855f7', angle: 0, delay: 0 },
    { icon: OneDriveIcon, color: '#0078d4', angle: 60, delay: 0.3 },
    { icon: GmailIcon, color: '#ea4335', angle: 120, delay: 0.6 },
    { icon: Folder, color: '#10b981', angle: 180, delay: 0.9 },
    { icon: GitBranch, color: '#ec4899', angle: 240, delay: 1.2 },
    { icon: SupabaseIcon, color: '#3ecf8e', angle: 300, delay: 1.5 },
  ];

  return (
    <section id="mcp" className="py-24 relative overflow-hidden max-w-full bg-slate-50/85 dark:bg-[#07050d]/85 backdrop-blur-md text-slate-900 dark:text-white border-y border-slate-200 dark:border-white/10 font-sans transition-colors duration-300">
      {/* Subtle Background Glow Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] max-w-[100vw] h-[500px] bg-gradient-to-r from-[#663af3]/5 dark:from-[#663af3]/15 via-[#f66e60]/5 dark:via-[#f66e60]/10 to-[#3b82f6]/5 dark:to-[#3b82f6]/15 blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <motion.h2
            {...reveal}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white"
          >
            Potencia tu flujo de trabajo con un Agente AI que{' '}
            <span className="bg-gradient-to-r from-[#f66e60] via-[#a855f7] to-[#3b82f6] bg-clip-text text-transparent">
              elimina la carga manual
            </span>.
          </motion.h2>

          <motion.p
            {...reveal}
            transition={{ delay: 0.2 }}
            className="text-base sm:text-lg text-slate-600 dark:text-gray-400"
          >
            Conecta Notion, OneDrive, Google Drive, Gmail y tu Filesystem local en una sola
            interfaz con ejecución IPC y controles de permisos configurables.
          </motion.p>
        </div>

        {/* BENTO GRID (3 Columns Top / 2 Columns Bottom) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Bento Card 1: Secure & Transparent (AES-256 Vault) */}
          <motion.div
            {...reveal}
            className="bg-white dark:bg-[#0e0b16]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden group hover:border-[#f66e60]/50 transition-all duration-300 flex flex-col justify-between shadow-sm dark:shadow-none"
          >
            {/* Background Matrix Rain Simulation */}
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_bottom,transparent_0%,#f66e60_50%,transparent_100%)] bg-[length:100%_4px] pointer-events-none" />

            <div className="relative z-10 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-[#f66e60]/10 border border-[#f66e60]/30 flex items-center justify-center mb-6 shadow-lg shadow-[#f66e60]/20 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-7 h-7 text-[#f66e60]" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono mb-3">
                Vault Cifrado AES-256
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Seguro &amp; Transparente</h3>
              <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed">
                Garantiza que todas las tareas en Modo Agente requieran confirmación modal previa
                y almacena tokens OAuth en la bóveda cifrada local.
              </p>
            </div>

            {/* Encrypted Lock Badge Display */}
            <div className="bg-slate-50 dark:bg-[#05030a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 font-mono text-xs flex items-center justify-between text-slate-600 dark:text-gray-300">
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#f66e60]" />
                IPC Channel Authorization
              </span>
              <span className="text-[#10b981] font-bold">VERIFICADO</span>
            </div>
          </motion.div>

          {/* Bento Card 2: Smart Workflow Automation (Step-by-step Execution) */}
          <motion.div
            {...reveal}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-[#0e0b16]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden group hover:border-[#a855f7]/50 transition-all duration-300 flex flex-col justify-between shadow-sm dark:shadow-none"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-xs font-mono text-[#a855f7] mb-4">
                <Zap className="w-4 h-4" />
                <span>Ejecución Paso a Paso</span>
              </div>

              {/* Dynamic Animated Steps List */}
              <div className="space-y-2 mb-6" aria-hidden="true">
                {workflowSteps.slice(0, 5).map((step, idx) => {
                  const isActive = activeStep === idx;
                  return (
                    <div
                      key={step.num}
                      className={`p-2.5 rounded-xl border text-xs font-mono transition-all duration-300 flex items-center gap-2.5 ${
                        isActive
                          ? 'bg-[#a855f7]/20 border-[#a855f7] text-purple-950 dark:text-white font-bold shadow-md shadow-[#a855f7]/20 scale-[1.02]'
                          : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 text-slate-600 dark:text-gray-400'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isActive
                          ? 'bg-[#a855f7] text-white'
                          : 'bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-gray-300'
                      }`}>
                        {step.num}
                      </span>
                      <span className="truncate">{step.text}</span>
                    </div>
                  );
                })}
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Automatización Inteligente</h3>
              <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed">
                Coordina flujos complejos entre múltiples aplicaciones en segundos sin escribir
                código manual.
              </p>
            </div>
          </motion.div>

          {/* Bento Card 3: Cross-Platform MCP Constellation WITH PRESERVED POLAR TRANSLATE */}
          <motion.div
            {...reveal}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-[#0e0b16]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden group hover:border-[#3b82f6]/50 transition-all duration-300 flex flex-col justify-between shadow-sm dark:shadow-none"
          >
            {/* SATELLITE CONSTELLATION CANVAS WITH ANIMATED FLOATING NODES & MOVING PULSE BEAMS */}
            <div className="relative w-full h-52 flex items-center justify-center mb-6">
              {/* Central Core Breathing Glow Ring */}
              <motion.div
                animate={shouldReduceMotion ? undefined : {
                  scale: [1, 1.12, 1],
                  opacity: [0.4, 0.8, 0.4],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: 'easeInOut',
                }}
                className="absolute w-24 h-24 rounded-full bg-gradient-to-r from-[#f66e60]/30 via-[#a855f7]/30 to-[#3b82f6]/30 blur-xl pointer-events-none"
              />

              {/* Central Core Orb */}
              <motion.div
                animate={shouldReduceMotion ? undefined : { scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#f66e60] via-[#a855f7] to-[#3b82f6] p-[2px] shadow-2xl shadow-[#3b82f6]/40 z-20"
              >
                <div className="w-full h-full bg-white dark:bg-[#07050d] rounded-2xl flex items-center justify-center">
                  <Bot className="w-8 h-8 text-slate-900 dark:text-white animate-pulse" />
                </div>
              </motion.div>

              {/* Animated Connecting SVG Lasers with Dash Offset Animation */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {constellationSatellites.map((sat, i) => {
                  const r = 78;
                  const rad = (sat.angle * Math.PI) / 180;
                  const x = Math.cos(rad) * r;
                  const y = Math.sin(rad) * r;
                  return (
                    <g key={i}>
                      {/* Base Dashed Line */}
                      <line
                        x1="50%"
                        y1="50%"
                        x2={`calc(50% + ${x}px)`}
                        y2={`calc(50% + ${y}px)`}
                        stroke={sat.color}
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity="0.5"
                      />
                      {/* Animated Pulse Beam Traveling Along Line */}
                      <line
                        x1="50%"
                        y1="50%"
                        x2={`calc(50% + ${x}px)`}
                        y2={`calc(50% + ${y}px)`}
                        stroke={sat.color}
                        strokeWidth="2.5"
                        strokeDasharray="8 16"
                        className="animate-laser-flow"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Satellite Nodes Orbit: Outer Wrapper for Fixed Polar Translate (x, y) + Inner Motion Div for Floating Animation */}
              {constellationSatellites.map((sat, i) => {
                const r = 78;
                const rad = (sat.angle * Math.PI) / 180;
                const x = Math.cos(rad) * r;
                const y = Math.sin(rad) * r;
                const IconC = sat.icon;
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      transform: `translate(${x}px, ${y}px)`,
                    }}
                    className="z-10"
                  >
                    <motion.div
                      animate={shouldReduceMotion ? undefined : {
                        y: [0, -5, 0],
                        scale: [1, 1.08, 1],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 3,
                        delay: sat.delay,
                        ease: 'easeInOut',
                      }}
                      className="w-10 h-10 rounded-2xl bg-white dark:bg-[#07050d] border border-slate-200 dark:border-white/20 flex items-center justify-center shadow-xl hover:border-slate-300 dark:hover:border-white/50 transition-colors"
                    >
                      <IconC className="w-5 h-5" />
                    </motion.div>
                  </div>
                );
              })}
            </div>

            <div className="relative z-10">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sincronización Multicontenido</h3>
              <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed">
                Mantiene tus herramientas sincronizadas con datos en tiempo real y comunicación
                nativa.
              </p>
            </div>
          </motion.div>
        </div>

        {/* BOTTOM BENTO GRID (2 Columns: Wide Multi-AI Chat Input + Notifications Stack) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Bento Card 4: Multi-AI Integration & Floating Chat Input Mockup (7 Cols) */}
          <motion.div
            {...reveal}
            className="lg:col-span-7 bg-white dark:bg-[#0e0b16]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden group hover:border-[#663af3]/50 transition-all duration-300 shadow-sm dark:shadow-none"
          >
            {/* CONTINUOUS INFINITE MARQUEE CAROUSEL ANIMATION FOR MCP ICONS */}
            <div className="relative overflow-hidden w-full mb-8 [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
              <motion.div
                animate={shouldReduceMotion ? { x: 0 } : { x: ['0%', '-50%'] }}
                transition={{
                  repeat: Infinity,
                  repeatType: 'loop',
                  duration: 20,
                  ease: 'linear',
                }}
                className="flex items-center gap-3 w-max"
              >
                {marqueeTools.map((t, idx) => {
                  const IconT = t.icon;
                  return (
                    <div
                      key={`${t.id}-${idx}`}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-sm hover:scale-110 hover:border-slate-300 dark:hover:border-white/30 transition-all cursor-pointer group/icon shrink-0"
                    >
                      <IconT className="w-6 h-6 transition-transform group-hover/icon:scale-110" />
                    </div>
                  );
                })}
              </motion.div>
            </div>

            {/* FLOATING CHAT PROMPT MOCKUP CARD */}
            <div className="bg-slate-50 dark:bg-[#080512] border border-slate-200 dark:border-white/15 rounded-2xl p-5 shadow-lg dark:shadow-2xl relative z-20 mb-6 group-hover:border-[#663af3]/60 transition-all">
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-3 font-mono flex items-center justify-between">
                <span>Prompt del Sistema</span>
                <span className="text-[#a855f7] font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Modo Agente Activo
                </span>
              </div>

              <div className="text-sm text-slate-800 dark:text-white font-medium mb-4">
                "Crea una página en Notion llamada 'Notas de Programación' y sincroniza el documento en OneDrive..."
              </div>

              {/* Chat Input Controls Bar */}
              <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
                  {/* Model Selector Dropdown Pill */}
                  <select
                    value={activeModel}
                    onChange={(e) => setActiveModel(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white text-xs rounded-xl px-3 py-2 font-mono cursor-pointer outline-none hover:bg-slate-200 dark:hover:bg-white/20 transition-colors sm:w-auto"
                  >
                    <option value="z-ai/glm-5.2" className="bg-[#0a0614] text-white">z-ai/glm-5.2</option>
                    <option value="gpt-4o" className="bg-[#0a0614] text-white">gpt-4o</option>
                    <option value="claude-3-5-sonnet" className="bg-[#0a0614] text-white">claude-3.5-sonnet</option>
                    <option value="gemini-2.5-flash" className="bg-[#0a0614] text-white">gemini-2.5-flash</option>
                  </select>

                  {/* Attachment Pill */}
                <div className="flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-2 font-mono text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <NotionIcon className="w-3.5 h-3.5 text-[#a855f7]" />
                    <OneDriveIcon className="w-3.5 h-3.5 text-[#0078d4]" />
                    <span className="truncate">@Notion @OneDrive</span>
                  </div>
                  <button type="button" aria-label="Enviar prompt de ejemplo" className="size-9 shrink-0 rounded-xl bg-[#663af3] text-white flex items-center justify-center shadow-lg shadow-[#663af3]/40 hover:scale-105 transition-transform">
                  <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Integración Multi-AI &amp; MCP</h3>
            <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed">
              Interactúa con más de 12 conectores usando lenguaje natural y sugerencias autocompletables.
            </p>
          </motion.div>

          {/* Bento Card 5: Real-Time Action Notifications (5 Cols) */}
          <motion.div
            {...reveal}
            transition={{ delay: 0.1 }}
            className="lg:col-span-5 bg-white dark:bg-[#0e0b16]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden group hover:border-[#10b981]/50 transition-all duration-300 flex flex-col justify-between shadow-sm dark:shadow-none"
          >
            <div>
              <div className="text-xs font-mono text-[#10b981] mb-4 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Notificaciones en Tiempo Real</span>
              </div>

              {/* Stacked Notification Pills with Official Brand SVGs */}
              <div className="space-y-3 mb-6">
                {[
                  {
                    icon: NotionIcon,
                    text: 'Buscando espacio de trabajo en Notion y páginas locales...',
                    color: '#a855f7',
                  },
                  {
                    icon: OneDriveIcon,
                    text: 'Subiendo archivo respaldado a Microsoft OneDrive...',
                    color: '#0078d4',
                  },
                  {
                    icon: GmailIcon,
                    text: 'Borrador de correo creado y listo en bandeja Gmail...',
                    color: '#ea4335',
                  },
                ].map((note, i) => {
                  const IconN = note.icon;
                  return (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080512] border border-slate-200 dark:border-[#ffffff]/10 flex items-center gap-3 text-xs text-slate-700 dark:text-gray-200 font-mono shadow-sm dark:shadow-md"
                    >
                      <IconN className="w-4 h-4 shrink-0" />
                      <span className="truncate">{note.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Resúmenes en Tiempo Real</h3>
              <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed">
                Recibe reportes transparentes y formateados de cada acción ejecutada en el sistema.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
