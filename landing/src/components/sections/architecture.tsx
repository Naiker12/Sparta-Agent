import React, { useEffect, useState } from 'react';
import { SectionHeader } from '../ui/section-header';
import {
  ShieldCheck,
  Zap,
  Clock,
  ArrowRight,
  Terminal,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  NotionIcon,
  OneDriveIcon,
  GoogleDriveIcon,
  SupabaseIcon,
} from '../icons/mcp-brand-icons';

export function Architecture() {
  const [activeTab, setActiveTab] = useState('layer1');

  const archTabs = [
    {
      id: 'layer1',
      tabName: 'Interfaz',
      layer: 'Capa 1',
      title: 'Presentación & UI (Frontend IDE)',
      desc: 'Interfaz local impulsada por React 18, Monaco Editor, Base UI y terminales xterm.js.',
      color: '#18181b',
      inputCard: {
        badge: 'Entrada · Frontend',
        title: 'Monaco Editor & Chat Panel',
        desc: 'Renderiza el editor Monaco, chat agéntico y terminales.',
        pills: [
          { name: 'Notion Workspace', icon: NotionIcon },
          { name: 'Monaco Editor', icon: Terminal },
        ],
        time: '0.0s',
      },
      actionCard: {
        badge: 'Acción · IPC',
        title: 'Puente IPC TypeScript Native',
        desc: 'Comunica el proceso UI con el orquestador principal.',
        model: 'Electron IPC',
        time: '0.2s',
      },
    },
    {
      id: 'layer2',
      tabName: 'Orquestación',
      layer: 'Capa 2',
      title: 'Orquestación & Security Broker',
      desc: 'Puente de comunicación que valida Sanitizer de comandos, PathGuard y Vault.',
      color: '#52525b',
      inputCard: {
        badge: 'Control · Seguridad',
        title: 'CommandSanitizer & PathGuard',
        desc: 'Restringe operaciones I/O dentro de los límites del workspace.',
        pills: [
          { name: 'Vault AES-256', icon: ShieldCheck },
          { name: 'Microsoft OneDrive', icon: OneDriveIcon },
        ],
        time: '0.4s',
      },
      actionCard: {
        badge: 'Acción · Conectores MCP',
        title: 'Llamada REST Directa (HTTP 200)',
        desc: 'Intercambio de tokens y bloques nativos para Notion/OneDrive.',
        model: 'OAuth 2.0 Vault',
        time: '1.1s',
      },
    },
    {
      id: 'layer3',
      tabName: 'Motor',
      layer: 'Capa 3',
      title: 'Núcleo Agéntico Nativo (TypeScript)',
      desc: 'Motor que ejecuta ciclos deterministas de planificación y auto-reflexión.',
      color: '#10b981',
      inputCard: {
        badge: 'Motor · Planificador',
        title: 'LangGraph State Machine',
        desc: 'Gestiona la memoria y el bucle de auto-corrección.',
        pills: [
          { name: 'ChromaDB Vector Store', icon: SupabaseIcon },
          { name: 'Google Drive RAG', icon: GoogleDriveIcon },
        ],
        time: '1.4s',
      },
      actionCard: {
        badge: 'Acción · Ejecución',
        title: 'Invocación LLM JSON-RPC',
        desc: 'Genera parches de código y resúmenes transparentes.',
        model: 'z-ai/glm-5.2',
        time: '2.8s',
      },
    },
  ];

  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;

    const timer = window.setInterval(() => {
      setActiveTab((currentId) => {
        const currentIndex = archTabs.findIndex((tab) => tab.id === currentId);
        return archTabs[(currentIndex + 1) % archTabs.length].id;
      });
    }, 4200);

    return () => window.clearInterval(timer);
  }, [shouldReduceMotion, archTabs.length]);

  const currentTab = archTabs.find((t) => t.id === activeTab) || archTabs[0];

  return (
    <section id="arquitectura" className="py-16 relative overflow-hidden max-w-full bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-white border-y border-slate-200 dark:border-white/10 font-sans transition-colors duration-300">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] max-w-[100vw] h-[250px] bg-[#18181b]/10 blur-[130px] pointer-events-none" />

      {/* UNIFIED CONTINUOUS GRID CONTAINER MAX-W-7XL BORDER-X */}
      <div className="mx-auto max-w-7xl border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <SectionHeader
          eyebrow="ARQUITECTURA DECOUPLED // 3 CAPAS"
          title="Arquitectura en tres capas"
          description="La interfaz, la orquestación IPC y el motor agéntico mantienen responsabilidades separadas para que el flujo sea predecible e inspeccionable."
        />

        {/* ORION STYLE COMPACT TAB BAR TOP */}
        <div role="tablist" aria-label="Capas de la arquitectura" className="mx-auto mt-8 mb-5 grid max-w-4xl grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#18181b]/90 dark:shadow-none">
          {archTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={isActive}
                className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2.5 text-center transition-all duration-300 cursor-pointer sm:flex-row sm:gap-2 sm:px-4 ${
                  isActive
                    ? 'bg-[#18181b] text-white shadow-md shadow-[#18181b]/40'
                    : 'bg-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Layers className="size-3.5 shrink-0" />
                <span className="text-xs font-semibold">{tab.tabName}</span>
                <span className="text-[10px] font-mono opacity-65 sm:hidden">{tab.layer}</span>
              </button>
            );
          })}
        </div>

        {/* COMPACT & SNUG NODE FLOW CANVAS SHOWCASE */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="tabpanel"
            className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-lg dark:border-white/15 dark:bg-[#18181b] dark:shadow-xl sm:p-6"
          >
            {/* Header Info */}
            <div className="mb-4 pb-3 border-b border-slate-200 dark:border-white/10">
              <span className="mb-1 block text-[10px] font-mono font-bold uppercase tracking-wider text-[#52525b]">
                {currentTab.layer}
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{currentTab.title}</h3>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">{currentTab.desc}</p>
            </div>

            {/* STAGGERED SEQUENTIAL NODE ANIMATION CANVAS (STEP 1 -> STEP 2 -> STEP 3) */}
            <div className="relative flex w-full flex-col items-stretch justify-between gap-3 py-2 md:flex-row md:items-center">
              {/* STEP 1 (t = 0.1s): NODE CARD 1 - INPUT NODE */}
              <motion.div
                initial={{ opacity: 0, x: -25, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
                className="relative w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-all hover:border-[#18181b]/60 dark:border-white/20 dark:bg-[#18181b] dark:shadow-md md:w-64"
              >
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 font-mono text-[9px] font-bold mb-1.5">
                  {currentTab.inputCard.badge}
                </div>

                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">{currentTab.inputCard.title}</h4>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 leading-tight mb-2">{currentTab.inputCard.desc}</p>

                {/* Sub-Pills Container with SVGL Icons */}
                <div className="bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 rounded-lg p-1.5 space-y-1 mb-2 font-mono text-[9px]">
                  {currentTab.inputCard.pills.map((pill, idx) => {
                    const PillIcon = pill.icon;
                    return (
                      <div key={idx} className="flex items-center gap-1.5 text-slate-600 dark:text-gray-300">
                        <PillIcon className="w-3.5 h-3.5" />
                        <span className="truncate">{pill.name}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Time Badge Footer */}
                <div className="flex items-center justify-end">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[9px] font-mono text-slate-500 dark:text-gray-400">
                    <Clock className="w-2.5 h-2.5 text-amber-400" />
                    <span>{currentTab.inputCard.time}</span>
                  </div>
                </div>
              </motion.div>

              {/* STEP 2 (t = 0.4s): CONNECTING ANIMATED LASER BEAM GROWING ACCROSS */}
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.4, delay: 0.4, ease: 'easeInOut' }}
                className="relative my-1 flex w-full origin-left items-center justify-center md:my-0 md:w-auto md:flex-1"
              >
                <div className="hidden md:block w-full h-[2px] bg-[#18181b]/40 relative overflow-hidden rounded-full">
                  <motion.div
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="w-1/2 h-full bg-gradient-to-r from-transparent via-[#52525b] to-transparent shadow-md shadow-[#52525b]"
                  />
                </div>
                <div className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-[#18181b] bg-[#18181b]/10 text-[#52525b] shadow-sm shadow-[#18181b]/30">
                  <ArrowRight className="size-3 -rotate-90 md:rotate-0" />
                </div>
              </motion.div>

              {/* STEP 3 (t = 0.7s): NODE CARD 2 - ACTION / ENGINE NODE */}
              <motion.div
                initial={{ opacity: 0, x: 25, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.7, ease: 'easeOut' }}
                className="relative w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-all hover:border-[#52525b]/60 dark:border-white/20 dark:bg-[#18181b] dark:shadow-md md:w-64"
              >
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[9px] font-bold mb-1.5">
                  {currentTab.actionCard.badge}
                </div>

                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">{currentTab.actionCard.title}</h4>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 leading-tight mb-2">{currentTab.actionCard.desc}</p>

                {/* Model Pill Badge & Time Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[9px] font-mono text-slate-500 dark:text-gray-400">
                    <Clock className="w-2.5 h-2.5 text-amber-400" />
                    <span>{currentTab.actionCard.time}</span>
                  </div>

                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#18181b]/20 border border-[#18181b]/40 text-[#52525b] font-mono text-[9px] font-bold">
                    <Zap className="w-2.5 h-2.5" />
                    <span>{currentTab.actionCard.model}</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
