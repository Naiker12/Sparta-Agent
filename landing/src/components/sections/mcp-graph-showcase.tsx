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
  Database,
  Terminal,
  Clock,
  Layers,
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
  { id: 'notion', name: 'Notion', icon: NotionIcon, color: '#e6e6e6', category: 'Productividad' },
  { id: 'onedrive', name: 'OneDrive', icon: OneDriveIcon, color: '#63a1ff', category: 'Almacenamiento' },
  { id: 'gdrive', name: 'Google Drive', icon: GoogleDriveIcon, color: '#59d499', category: 'Almacenamiento' },
  { id: 'gmail', name: 'Gmail', icon: GmailIcon, color: '#ff6363', category: 'Productividad' },
  { id: 'gcal', name: 'Google Calendar', icon: GoogleCalendarIcon, color: '#63a1ff', category: 'Productividad' },
  { id: 'fs', name: 'Filesystem', icon: Folder, color: '#59d499', category: 'DevTools' },
  { id: 'github', name: 'GitHub', icon: GitBranch, color: '#e6e6e6', category: 'DevTools' },
  { id: 'slack', name: 'Slack', icon: SlackIcon, color: '#ff6363', category: 'Comunicación' },
  { id: 'supabase', name: 'Supabase', icon: SupabaseIcon, color: '#59d499', category: 'Bases de Datos' },
  { id: 'dbhub', name: 'Postgres / SQLite', icon: Database, color: '#63a1ff', category: 'Bases de Datos' },
  { id: 'playwright', name: 'Playwright', icon: Globe, color: '#63a1ff', category: 'Web Subagents' },
  { id: 'fetch', name: 'Fetch Parser', icon: Download, color: '#fbbf24', category: 'DevTools' },
  { id: 'memory', name: 'Knowledge Graph', icon: Cpu, color: '#ff6363', category: 'Memoria' },
  { id: 'time', name: 'System Time', icon: Clock, color: '#9c9c9d', category: 'Sistema' },
];

export function McpGraphShowcase() {
  const [activeModel, setActiveModel] = useState('Claude 3.7 Sonnet / Ollama');
  const [activeStep, setActiveStep] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? { initial: false, animate: { opacity: 1, y: 0 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  useEffect(() => {
    if (shouldReduceMotion) return;

    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 6);
    }, 2400);
    return () => clearInterval(timer);
  }, [shouldReduceMotion]);

  const workflowSteps = [
    { num: 1, text: 'Buscando espacio de trabajo en Notion (JSON-RPC)...' },
    { num: 2, text: 'Leyendo esquema SQL en PostgreSQL local...' },
    { num: 3, text: 'Generando AST y diff de código con Monaco Editor...' },
    { num: 4, text: 'Invocando Tokio Sidecar IPC (sub-milisegundo)...' },
    { num: 5, text: 'Activando diálogo modal de permisos explícito...' },
    { num: 6, text: 'Reportando cambios estructurados en formato Markdown...' },
  ];

  // Doubled array for seamless infinite marquee loop
  const marqueeTools = [...ALL_MCP_TOOLS, ...ALL_MCP_TOOLS];

  return (
    <section id="mcp" className="py-24 relative overflow-hidden max-w-full bg-[#040506] text-white border-y border-[#363739]">
      {/* Subtle Atmospheric Raycast Coral / Cobalt Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] max-w-[100vw] h-[400px] bg-radial from-[#ff6363]/8 via-[#63a1ff]/5 to-transparent blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <motion.div
            {...reveal}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#363739] bg-[#07080a] text-xs font-mono text-[#9c9c9d] shadow-key"
          >
            <Layers className="size-3.5 text-[#ff6363]" />
            <span>MODEL CONTEXT PROTOCOL (MCP)</span>
          </motion.div>

          <motion.h2
            {...reveal}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl font-semibold sm:font-bold tracking-tight leading-tight text-white"
          >
            Ecosistema de conectores MCP nativo y seguro.
          </motion.h2>

          <motion.p
            {...reveal}
            transition={{ delay: 0.2 }}
            className="text-sm sm:text-base text-[#9c9c9d] leading-relaxed max-w-2xl mx-auto font-normal"
          >
            Conecta GitHub, Filesystem, bases de datos SQL, Notion, Slack y Google Workspace mediante
            el protocolo estándar abierto MCP con canal IPC seguro y autorización previa.
          </motion.p>
        </div>

        {/* BENTO GRID (3 Columns Top / 2 Columns Bottom) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Bento Card 1: Secure Vault & Permissions */}
          <motion.div
            {...reveal}
            className="bg-[#07080a] border border-[#363739] rounded-[20px] p-6 sm:p-8 relative overflow-hidden group hover:border-white/30 transition-all duration-300 flex flex-col justify-between shadow-key"
          >
            <div className="relative z-10 mb-8">
              <div className="size-12 rounded-xl bg-[#111214] border border-[#363739] flex items-center justify-center mb-6 shadow-key group-hover:scale-105 transition-transform">
                <ShieldCheck className="size-6 text-[#ff6363]" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-[#59d499]/10 border border-[#59d499]/30 text-[#59d499] text-[10px] font-mono mb-3">
                Vault Cifrado AES-256-GCM
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Permisos y Bóveda Segura</h3>
              <p className="text-xs text-[#9c9c9d] leading-relaxed">
                Cada llamada que implique mutaciones en Modo Agente activa una tarjeta modal de confirmación
                previa. Tus claves de API residen cifradas en el almacén local.
              </p>
            </div>

            {/* Encrypted Lock Badge Display */}
            <div className="bg-[#040506] border border-[#363739] rounded-xl p-3.5 font-mono text-xs flex items-center justify-between text-[#9c9c9d]">
              <span className="flex items-center gap-2">
                <Lock className="size-3.5 text-[#ff6363]" />
                <span>Canal IPC Seguro</span>
              </span>
              <span className="text-[#59d499] font-medium text-[11px]">ACTIVO</span>
            </div>
          </motion.div>

          {/* Bento Card 2: Smart Step-by-step Workflow */}
          <motion.div
            {...reveal}
            transition={{ delay: 0.1 }}
            className="bg-[#07080a] border border-[#363739] rounded-[20px] p-6 sm:p-8 relative overflow-hidden group hover:border-white/30 transition-all duration-300 flex flex-col justify-between shadow-key"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-xs font-mono text-[#63a1ff] mb-4">
                <Zap className="size-4" />
                <span>Orquestación LangGraph</span>
              </div>

              {/* Dynamic Animated Steps List */}
              <div className="space-y-2 mb-6" aria-hidden="true">
                {workflowSteps.slice(0, 5).map((step, idx) => {
                  const isActive = activeStep === idx;
                  return (
                    <div
                      key={step.num}
                      className={`p-2.5 rounded-lg border text-xs font-mono transition-all duration-300 flex items-center gap-2.5 ${
                        isActive
                          ? 'bg-[#111214] border-white/40 text-white font-medium shadow-key scale-[1.01]'
                          : 'bg-[#040506] border-[#363739]/60 text-[#6a6b6c]'
                      }`}
                    >
                      <span
                        className={`size-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isActive ? 'bg-[#ff6363] text-white' : 'bg-[#1b1c1e] text-[#6a6b6c]'
                        }`}
                      >
                        {step.num}
                      </span>
                      <span className="truncate">{step.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-[#9c9c9d] border-t border-[#363739]/60">
              <span className="font-mono text-[11px]">JSON-RPC 2.0 Client</span>
              <span className="text-[#59d499] flex items-center gap-1 font-mono text-[11px]">
                <CheckCircle2 className="size-3" /> Sincronizado
              </span>
            </div>
          </motion.div>

          {/* Bento Card 3: Multi-Provider Gateway */}
          <motion.div
            {...reveal}
            transition={{ delay: 0.2 }}
            className="bg-[#07080a] border border-[#363739] rounded-[20px] p-6 sm:p-8 relative overflow-hidden group hover:border-white/30 transition-all duration-300 flex flex-col justify-between shadow-key"
          >
            <div className="relative z-10 mb-6">
              <div className="size-12 rounded-xl bg-[#111214] border border-[#363739] flex items-center justify-center mb-6 shadow-key group-hover:scale-105 transition-transform">
                <Bot className="size-6 text-[#63a1ff]" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-[#63a1ff]/10 border border-[#63a1ff]/30 text-[#63a1ff] text-[10px] font-mono mb-3">
                Local + Cloud Hybrid
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Pasarela Multi-Proveedor</h3>
              <p className="text-xs text-[#9c9c9d] leading-relaxed">
                Alterna entre Ollama y vLLM local para máxima privacidad o conecta Claude 3.7, GPT-4o y Gemini
                para razonamiento intensivo.
              </p>
            </div>

            {/* In-use Pill Selector */}
            <div className="bg-[#040506] border border-[#363739] rounded-xl p-3 flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-[#e6e6e6] truncate">{activeModel}</span>
              <span className="px-2 py-0.5 rounded bg-[#111214] border border-[#363739] text-[10px] font-mono text-[#59d499]">
                LISTO
              </span>
            </div>
          </motion.div>
        </div>

        {/* INFINITE MARQUEE OF OFFICIAL MCP CONNECTORS */}
        <div className="mt-12 pt-8 border-t border-[#363739]/60">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.08em] text-[#6a6b6c] mb-6">
            Servidores MCP validados en Sparta Agent
          </p>

          <div className="relative w-full overflow-hidden mask-linear-fade">
            <div className="flex w-max animate-marquee space-x-4">
              {marqueeTools.map((tool, idx) => {
                const IconComponent = tool.icon;
                return (
                  <div
                    key={`${tool.id}-${idx}`}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#07080a] border border-[#363739] shadow-key text-xs font-mono text-[#e6e6e6] hover:border-white/30 transition-colors"
                  >
                    <IconComponent className="size-4 shrink-0" style={{ color: tool.color }} />
                    <span>{tool.name}</span>
                    <span className="text-[10px] text-[#6a6b6c]">({tool.category})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
