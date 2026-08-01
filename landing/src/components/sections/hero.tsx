import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ShieldCheck,
  Star,
  CheckCircle2,
  Terminal,
} from 'lucide-react';

export function Hero() {
  const [activeTab, setActiveTab] = useState('notion-office');

  const useCases = [
    {
      id: 'notion-office',
      label: 'Sincronización Notion & Office',
      title: 'Creación Nativa de Páginas en Notion y Subida a OneDrive',
      desc: 'Formatea bloques de contenido nativo en Notion y respalda documentos en OneDrive/SharePoint mediante Microsoft Graph API.',
      samplePrompt: 'Crea una página en Notion llamada "Notas de Programación" y sube el respaldo a OneDrive',
      sampleOutput: '✓ Bloques Heading_2 y listas agregados nativamente a Notion | Archivo guardado en /OneDrive/Documents',
    },
    {
      id: 'code-refactor',
      label: 'Refactorización & Tests Unitarios',
      title: 'Inspección de Archivos y Generación de Código Limpio',
      desc: 'Analiza tu workspace local sin enviar información confidencial a servidores de terceros de manera insegura.',
      samplePrompt: 'Genera los tests unitarios con Vitest para tool-executor.ts en ia-sparta-chat-ipc',
      sampleOutput: '✓ 14 casos de prueba pasaron limpiamente (0 fallos) en 48ms',
    },
    {
      id: 'security-broker',
      label: 'Security PathGuard & Modos',
      title: 'Diferenciación Estricta de Modo Chat (Lectura) vs Agente (Escritura)',
      desc: 'Cada acción de modificación activa obligatoriamente la confirmación modal previa para aprobación directa del usuario.',
      samplePrompt: 'Modo Agente: Eliminar o sobreescribir archivos en el directorio del proyecto',
      sampleOutput: '🛡️ Diálogo Modal de Permisos activado para aprobación del usuario',
    },
  ];

  const currentCase = useCases.find((c) => c.id === activeTab) || useCases[0];

  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-transparent font-sans">
      {/* Orion-style Border Grid Aligners */}
      <div className="mx-auto max-w-7xl border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8 text-center py-8 sm:py-16">
          {/* Orion Border Beam Badge Top */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center overflow-hidden rounded-full border border-slate-300 dark:border-white/15 bg-slate-100/90 dark:bg-white/[0.04] px-4 py-1.5 text-xs text-slate-800 dark:text-gray-300 backdrop-blur-md relative group shadow-sm"
          >
            <span className="bg-[#663af3] text-white flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase mr-2.5 shadow-sm">
              🔥 Nuevo
            </span>
            <span className="font-mono font-bold text-slate-800 dark:text-gray-200">
              Conectores MCP &amp; Ejecución IPC Nativa en TypeScript
            </span>
          </motion.div>

          {/* Hero Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.15] text-slate-900 dark:text-white max-w-4xl"
          >
            Trabaja con un Agente IA que{' '}
            <span className="bg-gradient-to-r from-[#f66e60] via-[#a855f7] to-[#3b82f6] bg-clip-text text-transparent">
              gestiona tus operaciones
            </span>{' '}
            diarias.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-xl text-slate-600 dark:text-gray-300 max-w-3xl leading-relaxed font-medium"
          >
            Automatiza tareas repetitivas en Notion, OneDrive, Google Drive, Gmail y tu Filesystem
            local sin depender de procesos o sidecars externos.
          </motion.p>

          {/* 3D Inset CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-2"
          >
            <a href="#mcp">
              <button className="group/button inline-flex items-center justify-center font-semibold text-base text-white bg-[#663af3] hover:bg-[#5b2ee0] h-12 px-7 rounded-xl border-0 shadow-lg shadow-[#663af3]/30 transition-all duration-300 active:translate-y-px gap-2 cursor-pointer">
                <span>Explorar Conectores MCP</span>
                <ArrowUpRight className="w-5 h-5 transition-transform group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
              </button>
            </a>

            <a href="#descargas">
              <button className="group/button inline-flex items-center justify-center font-semibold text-base text-slate-800 dark:text-gray-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 h-12 px-7 rounded-xl border border-slate-300 dark:border-white/15 shadow-sm transition-all duration-300 active:translate-y-px gap-2 cursor-pointer">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Ver Seguridad &amp; Vault</span>
              </button>
            </a>
          </motion.div>

          {/* Social Proof & Rating Bar */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-4 border-t border-slate-200 dark:border-white/10 w-full max-w-2xl mt-4"
          >
            {/* Avatar Stack */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {['#a855f7', '#0078d4', '#10b981', '#ea4335'].map((color, idx) => (
                  <div
                    key={idx}
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-[#07050d] flex items-center justify-center text-[10px] font-bold text-white shadow-md"
                    style={{ backgroundColor: color }}
                  >
                    DEV
                  </div>
                ))}
              </div>
              <div className="text-left text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">12K+ Desarrolladores</span>
                <span className="text-slate-600 dark:text-gray-400 font-mono text-[11px]">Equipos &amp; Asistente IDE</span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

            {/* Stars Rating */}
            <div className="flex items-center gap-2">
              <div className="flex text-amber-500 dark:text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <div className="text-left text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">4.9 / 5.0</span>
                <span className="text-slate-600 dark:text-gray-400 font-mono text-[11px]">Calificación Comunidad</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Interactive Use Case Tabs Bar (Orion Tab Bar) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="border-t border-slate-200 dark:border-white/10 pt-8 pb-4"
        >
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {useCases.map((uc) => (
              <button
                key={uc.id}
                onClick={() => setActiveTab(uc.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activeTab === uc.id
                    ? 'bg-[#663af3] text-white shadow-lg shadow-[#663af3]/30 scale-105'
                    : 'bg-slate-100 dark:bg-white/[0.03] text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5'
                }`}
              >
                {uc.label}
              </button>
            ))}
          </div>

          {/* Active Preview Showcase Box */}
          <div className="bg-white dark:bg-[#080512] border border-slate-200 dark:border-white/15 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl dark:shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">{currentCase.title}</h4>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold">
                ✓ Listo para Producción
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-gray-300 mb-6">{currentCase.desc}</p>

            {/* Prompt & Execution Terminal Box (Always Dark for IDE Terminal Feel) */}
            <div className="bg-[#05030a] border border-slate-800 dark:border-white/10 rounded-2xl p-4 font-mono text-xs space-y-2 text-white shadow-inner">
              <div className="flex items-center gap-2 text-purple-300">
                <Terminal className="w-4 h-4 text-[#a855f7]" />
                <span>Entrada Prompt:</span>
              </div>
              <div className="text-white bg-white/10 p-2.5 rounded-xl border border-white/10">
                "{currentCase.samplePrompt}"
              </div>
              <div className="text-emerald-400 pt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{currentCase.sampleOutput}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
