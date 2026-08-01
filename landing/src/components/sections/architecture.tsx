import React, { useState } from 'react';
import { SectionHeader } from '../ui/section-header';
import {
  Layout,
  Server,
  Cpu,
  ShieldCheck,
  Zap,
  Clock,
  ArrowRight,
  Terminal,
  Layers,
  Database,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  NotionIcon,
  OneDriveIcon,
  GoogleDriveIcon,
  GmailIcon,
  SupabaseIcon,
} from '../icons/mcp-brand-icons';

export function Architecture() {
  const [activeTab, setActiveTab] = useState('layer1');

  const archTabs = [
    {
      id: 'layer1',
      tabName: 'Capa 1: Frontend IDE',
      title: 'Presentación & UI (Frontend IDE)',
      desc: 'Interfaz local impulsada por React 18, Monaco Editor, Base UI y terminales xterm.js.',
      color: '#663af3',
      inputCard: {
        badge: '📥 Input / Frontend',
        title: 'Monaco Editor & Chat Panel',
        desc: 'Renderiza el editor Monaco, chat agéntico y terminales.',
        pills: [
          { name: 'Notion Workspace', icon: NotionIcon },
          { name: 'Monaco Editor', icon: Terminal },
        ],
        time: '0.0s',
      },
      actionCard: {
        badge: '⚡ Action / IPC Dispatcher',
        title: 'Puente IPC TypeScript Native',
        desc: 'Comunica el proceso UI con el orquestador principal.',
        model: 'Electron IPC',
        time: '0.2s',
      },
    },
    {
      id: 'layer2',
      tabName: 'Capa 2: Orquestación IPC',
      title: 'Orquestación & Security Broker',
      desc: 'Puente de comunicación que valida Sanitizer de comandos, PathGuard y Vault.',
      color: '#a855f7',
      inputCard: {
        badge: '🔒 Interceptor / Security',
        title: 'CommandSanitizer & PathGuard',
        desc: 'Restringe operaciones I/O dentro de los límites del workspace.',
        pills: [
          { name: 'Vault AES-256', icon: ShieldCheck },
          { name: 'Microsoft OneDrive', icon: OneDriveIcon },
        ],
        time: '0.4s',
      },
      actionCard: {
        badge: '⚡ Action / Conectores MCP',
        title: 'Llamada REST Directa (HTTP 200)',
        desc: 'Intercambio de tokens y bloques nativos para Notion/OneDrive.',
        model: 'OAuth 2.0 Vault',
        time: '1.1s',
      },
    },
    {
      id: 'layer3',
      tabName: 'Capa 3: Motor Nativo TS',
      title: 'Núcleo Agéntico Nativo (TypeScript)',
      desc: 'Motor que ejecuta ciclos deterministas de planificación y auto-reflexión.',
      color: '#10b981',
      inputCard: {
        badge: '🧠 Engine / Planner',
        title: 'LangGraph State Machine',
        desc: 'Gestiona la memoria y el bucle de auto-corrección.',
        pills: [
          { name: 'ChromaDB Vector Store', icon: SupabaseIcon },
          { name: 'Google Drive RAG', icon: GoogleDriveIcon },
        ],
        time: '1.4s',
      },
      actionCard: {
        badge: '⚡ Action / Execution Node',
        title: 'Invocación LLM JSON-RPC',
        desc: 'Genera parches de código y resúmenes transparentes.',
        model: 'z-ai/glm-5.2',
        time: '2.8s',
      },
    },
  ];

  const currentTab = archTabs.find((t) => t.id === activeTab) || archTabs[0];

  return (
    <section id="arquitectura" className="py-16 relative bg-slate-50 dark:bg-[#07050d] text-slate-900 dark:text-white border-y border-slate-200 dark:border-white/10 font-sans transition-colors duration-300">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-[#663af3]/10 blur-[130px] pointer-events-none" />

      {/* UNIFIED CONTINUOUS GRID CONTAINER MAX-W-7XL BORDER-X */}
      <div className="mx-auto max-w-7xl border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <SectionHeader
          eyebrow="ARQUITECTURA DECOUPLED // 3 CAPAS"
          title="Estructura Decoupled de 3 Capas"
          description="Sin bloqueos en el hilo principal de la UI. Separación limpia de responsabilidades entre presentación, orquestación nativa y razonamiento en TypeScript."
        />

        {/* ORION STYLE COMPACT TAB BAR TOP */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-8 mb-5 bg-white dark:bg-[#0e0b16]/90 border border-slate-200 dark:border-white/10 rounded-xl p-1 backdrop-blur-xl max-w-3xl mx-auto shadow-sm dark:shadow-none">
          {archTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[130px] py-1.5 px-3 rounded-lg text-[11px] font-bold font-mono transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 ${
                  isActive
                    ? 'bg-[#663af3] text-white shadow-md shadow-[#663af3]/40'
                    : 'bg-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{tab.tabName}</span>
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
            className="bg-white dark:bg-[#0c0915] border border-slate-200 dark:border-white/15 rounded-2xl p-5 backdrop-blur-2xl shadow-lg dark:shadow-xl max-w-3xl mx-auto"
          >
            {/* Header Info */}
            <div className="mb-4 pb-3 border-b border-slate-200 dark:border-white/10">
              <span className="text-[9px] font-mono text-[#a855f7] block font-bold uppercase tracking-wider mb-0.5">
                {currentTab.tabName}
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{currentTab.title}</h3>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">{currentTab.desc}</p>
            </div>

            {/* STAGGERED SEQUENTIAL NODE ANIMATION CANVAS (STEP 1 -> STEP 2 -> STEP 3) */}
            <div className="relative w-full py-2 flex flex-col md:flex-row items-center justify-between gap-3">
              {/* STEP 1 (t = 0.1s): NODE CARD 1 - INPUT NODE */}
              <motion.div
                initial={{ opacity: 0, x: -25, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
                className="w-full md:w-64 bg-white dark:bg-[#0e0b18] border border-slate-200 dark:border-white/20 rounded-xl p-3.5 shadow-sm dark:shadow-md relative group hover:border-[#663af3]/60 transition-all shrink-0"
              >
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 font-mono text-[9px] font-bold mb-1.5">
                  {currentTab.inputCard.badge}
                </div>

                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">{currentTab.inputCard.title}</h4>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 leading-tight mb-2">{currentTab.inputCard.desc}</p>

                {/* Sub-Pills Container with SVGL Icons */}
                <div className="bg-slate-50 dark:bg-[#05030a] border border-slate-200 dark:border-white/10 rounded-lg p-1.5 space-y-1 mb-2 font-mono text-[9px]">
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
                className="flex md:flex-1 items-center justify-center relative w-full md:w-auto my-1 md:my-0 origin-left"
              >
                <div className="hidden md:block w-full h-[2px] bg-[#663af3]/40 relative overflow-hidden rounded-full">
                  <motion.div
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="w-1/2 h-full bg-gradient-to-r from-transparent via-[#a855f7] to-transparent shadow-md shadow-[#a855f7]"
                  />
                </div>
                <div className="w-6 h-6 rounded-full bg-[#663af3]/30 border border-[#663af3] flex items-center justify-center text-[#a855f7] shrink-0 z-10 shadow-sm shadow-[#663af3]/50">
                  <ArrowRight className="w-3 h-3" />
                </div>
              </motion.div>

              {/* STEP 3 (t = 0.7s): NODE CARD 2 - ACTION / ENGINE NODE */}
              <motion.div
                initial={{ opacity: 0, x: 25, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.7, ease: 'easeOut' }}
                className="w-full md:w-64 bg-white dark:bg-[#0e0b18] border border-slate-200 dark:border-white/20 rounded-xl p-3.5 shadow-sm dark:shadow-md relative group hover:border-[#a855f7]/60 transition-all shrink-0"
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

                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#663af3]/20 border border-[#663af3]/40 text-[#a855f7] font-mono text-[9px] font-bold">
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
