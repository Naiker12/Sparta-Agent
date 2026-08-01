import React, { useState } from 'react';
import { SectionHeader } from '../ui/section-header';
import {
  Eye,
  Edit3,
  Slash,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  NotionIcon,
  OneDriveIcon,
  GoogleDriveIcon,
  GmailIcon,
  SlackIcon,
  SupabaseIcon,
} from '../icons/mcp-brand-icons';

export function SecurityMatrix() {
  const [activePolicy, setActivePolicy] = useState<'CHAT' | 'AGENT'>('AGENT');

  return (
    <section id="seguridad" className="py-20 relative bg-white dark:bg-[#07050d] text-slate-900 dark:text-white border-y border-slate-200 dark:border-white/10 font-sans transition-colors duration-300">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-r from-[#f66e60]/10 via-[#663af3]/15 to-[#10b981]/10 blur-[150px] pointer-events-none" />

      <div className="mx-auto max-w-7xl border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <SectionHeader
          eyebrow="MATRIZ DE SEGURIDAD NATIVA // STANDARD SVGL"
          title="Cero Sorpresas. Control de Permisos por Diseño."
          description="El broker de seguridad integrado intercepta todas las operaciones I/O en la capa del sistema operativo antes de su ejecución."
        />

        {/* 3 HIGH-IMPACT BENTO CARDS WITH TOP SVGL BRAND BADGES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-12">
          {/* Bento Card 1: PermissionPolicy Modes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white dark:bg-[#0e0b16]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between hover:border-[#663af3]/50 transition-all duration-300 relative overflow-hidden group shadow-sm dark:shadow-none"
          >
            <div>
              {/* TOP ICON BADGE WITH SVGL BRAND ICON */}
              <div className="w-12 h-12 rounded-2xl bg-[#663af3]/20 border border-[#663af3]/40 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-[#663af3]/30">
                <NotionIcon className="w-6 h-6" />
              </div>

              <div className="inline-block px-2.5 py-0.5 rounded-full bg-[#663af3]/10 border border-[#663af3]/30 text-[#a855f7] text-[10px] font-mono mb-3">
                01. PermissionPolicy Engine
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Modos de Operación Seguros</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed mb-6">
                Separación estricta entre consultas de solo lectura y modificaciones con autorización explícita.
              </p>

              {/* Mode Selector Simulator */}
              <div className="bg-slate-50 dark:bg-[#05030a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 font-mono text-xs space-y-3 mb-4">
                <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 pb-2 border-b border-slate-200 dark:border-white/10 text-[11px]">
                  <span>MODO SELECCIONADO</span>
                  <span className={activePolicy === 'AGENT' ? 'text-emerald-400 font-bold' : 'text-sky-400 font-bold'}>
                    {activePolicy === 'AGENT' ? 'MODO AGENTE' : 'MODO CHAT'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActivePolicy('CHAT')}
                    className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      activePolicy === 'CHAT'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-800 dark:text-sky-300 shadow-md'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Modo Chat</span>
                  </button>

                  <button
                    onClick={() => setActivePolicy('AGENT')}
                    className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      activePolicy === 'AGENT'
                        ? 'bg-[#663af3] border-[#663af3] text-white shadow-md shadow-[#663af3]/40'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modo Agente</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 text-[11px] text-slate-700 dark:text-gray-300 leading-relaxed shadow-xs dark:shadow-none">
                  {activePolicy === 'CHAT' ? (
                    <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Solo lectura habilitada (`search_files`, `read_file`, `web_search`).
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Escritura autorizada previa aprobación en Diálogo Modal de Permisos (`PermissionRequestDialog`).
                    </span>
                  )}
                </div>

                {/* SVGL Connector Badges */}
                <div className="flex items-center gap-2 pt-1 font-mono">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] text-slate-700 dark:text-gray-300">
                    <NotionIcon className="w-3 h-3" />
                    <span>Notion API</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] text-slate-700 dark:text-gray-300">
                    <OneDriveIcon className="w-3 h-3" />
                    <span>OneDrive Vault</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-500 dark:text-gray-400 flex items-center justify-between">
              <span>Bóveda Local:</span>
              <strong className="text-slate-900 dark:text-white">Cifrada AES-256</strong>
            </div>
          </motion.div>

          {/* Bento Card 2: CommandSanitizer Threat Interceptor */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-[#0e0b16]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between hover:border-[#f66e60]/50 transition-all duration-300 relative overflow-hidden group shadow-sm dark:shadow-none"
          >
            <div>
              {/* TOP ICON BADGE WITH SVGL BRAND ICON */}
              <div className="w-12 h-12 rounded-2xl bg-[#f66e60]/20 border border-[#f66e60]/40 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-[#f66e60]/30">
                <SlackIcon className="w-6 h-6" />
              </div>

              <div className="inline-block px-2.5 py-0.5 rounded-full bg-[#f66e60]/10 border border-[#f66e60]/30 text-[#f66e60] text-[10px] font-mono mb-3">
                02. CommandSanitizer Subprocess
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Interceptor de Subprocesos</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed mb-6">
                Filtro sintáctico que destruye comandos peligrosos o scripts destructivos antes de su invocación.
              </p>

              {/* Blocked Commands List */}
              <div className="space-y-2 mb-4 font-mono text-xs">
                {[
                  { cmd: 'rm -rf /', reason: 'Comando Destructivo Bloqueado' },
                  { cmd: 'dd if=/dev/zero of=/dev/sda', reason: 'Sobreescritura Denegada' },
                  { cmd: 'curl http://unverified | bash', reason: 'Script Inseguro Interceptado' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Slash className="w-3.5 h-3.5 text-[#f66e60] shrink-0" />
                      <span className="font-bold truncate">{item.cmd}</span>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-700 dark:text-red-400 shrink-0">
                      BLOQUEADO
                    </span>
                  </div>
                ))}
              </div>

              {/* SVGL Connector Badges */}
              <div className="flex items-center gap-2 pt-1 font-mono">
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] text-slate-700 dark:text-gray-300">
                  <SlackIcon className="w-3 h-3" />
                  <span>Slack Webhook</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] text-slate-700 dark:text-gray-300">
                  <GmailIcon className="w-3 h-3" />
                  <span>Gmail Mailer</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-500 dark:text-gray-400 flex items-center justify-between">
              <span>Latencia Interceptor:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">&lt; 1ms Overhead</strong>
            </div>
          </motion.div>

          {/* Bento Card 3: PathGuard & Workspace Denylist */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-[#0e0b16]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between hover:border-[#10b981]/50 transition-all duration-300 relative overflow-hidden group shadow-sm dark:shadow-none"
          >
            <div>
              {/* TOP ICON BADGE WITH SVGL BRAND ICON */}
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/30">
                <GoogleDriveIcon className="w-6 h-6" />
              </div>

              <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono mb-3">
                03. PathGuard &amp; Denylist Boundary
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Aislamiento de Archivos Sensibles</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed mb-6">
                Confinamiento estricto dentro de la carpeta del proyecto. Los secretos y llaves están denegados por omisión.
              </p>

              {/* Protected Paths Table */}
              <div className="space-y-2 mb-4 font-mono text-xs">
                {[
                  { path: '.env / .env.local', status: 'DENEGADO (PROTEGIDO)' },
                  { path: '*.pem / *.key / id_rsa', status: 'DENEGADO (PROTEGIDO)' },
                  { path: '~/System32 / /etc/passwd', status: 'FUERA DE LÍMITES' },
                ].map((p, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#05030a] border border-slate-200 dark:border-white/10 flex items-center justify-between text-[11px]"
                  >
                    <span className="text-slate-800 dark:text-gray-300 font-bold truncate">{p.path}</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-400 shrink-0">
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* SVGL Connector Badges */}
              <div className="flex items-center gap-2 pt-1 font-mono">
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] text-slate-700 dark:text-gray-300">
                  <SupabaseIcon className="w-3 h-3" />
                  <span>Supabase DB</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] text-slate-700 dark:text-gray-300">
                  <GoogleDriveIcon className="w-3 h-3" />
                  <span>Google Drive</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-500 dark:text-gray-400 flex items-center justify-between">
              <span>Límite Workspace:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">100% AISLADO</strong>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
