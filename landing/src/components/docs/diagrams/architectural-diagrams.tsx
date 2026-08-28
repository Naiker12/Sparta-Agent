import React from 'react';
import {
  ShieldCheck,
  Lock,
  Cpu,
  Layers,
  Terminal,
  Database,
  Search,
  Bot,
  CheckCircle2,
  AlertTriangle,
  FolderLock,
  Workflow,
  ArrowRight,
  ArrowDown,
  Globe,
  FileCode,
  FileSpreadsheet,
  FileText,
  Key,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ── 1. Security Isolation Layered Diagram ────────────────────────────────────
export function SecurityIsolationDiagram() {
  return (
    <div className="my-8 rounded-2xl border border-[#363739] bg-[#07080a] p-5 sm:p-7 shadow-key overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#363739]/60 pb-3 mb-6 font-mono text-xs text-[#9c9c9d]">
        <span className="flex items-center gap-2 text-white">
          <ShieldCheck className="size-4 text-[#ff6363]" />
          Arquitectura de Aislamiento en Capas (Zero-Trust Local Engine)
        </span>
        <span className="px-2 py-0.5 rounded bg-[#111214] border border-[#363739] text-[10px] text-[#59d499]">
          100% OFFLINE / LOCAL
        </span>
      </div>

      <div className="space-y-4">
        {/* Layer 1: Electron UI */}
        <div className="p-4 rounded-xl border border-[#363739] bg-[#111214] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-key">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-[#1b1c1e] border border-[#363739] flex items-center justify-center text-[#63a1ff]">
              <Layers className="size-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">1. Frontend UI &amp; Monaco Editor</div>
              <div className="text-xs text-[#9c9c9d]">Electron 34 · React 19 · ContextIsolation activo · Node desactivado</div>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase px-2 py-1 rounded bg-[#1b1c1e] border border-[#363739] text-[#9c9c9d]">
            Renderer Aislado
          </span>
        </div>

        {/* Connector Line */}
        <div className="flex justify-center -my-1">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#040506] border border-[#363739] text-[11px] font-mono text-[#63a1ff]">
            <ArrowDown className="size-3 text-[#63a1ff] animate-bounce" />
            <span>Canal IPC Seguro (Type-Safe RPC · window.spartaAPI)</span>
          </div>
        </div>

        {/* Layer 2: Rust Tokio Sidecar & Permission Broker */}
        <div className="p-5 rounded-xl border border-[#ff6363]/40 bg-[#111214] relative overflow-hidden shadow-key">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-lg bg-[#ff6363]/10 border border-[#ff6363]/30 flex items-center justify-center text-[#ff6363]">
                <Cpu className="size-5" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">2. Rust Sidecar Engine (Tokio Runtime)</div>
                <div className="text-xs text-[#9c9c9d]">Aislamiento nativo de memoria · Latencia &lt; 1ms</div>
              </div>
            </div>
            <span className="font-mono text-[10px] text-[#ff6363] px-2 py-0.5 rounded bg-[#ff6363]/10 border border-[#ff6363]/30">
              SYS-CALL INTERCEPTOR
            </span>
          </div>

          {/* Sub-box: Permission Modal Interceptor */}
          <div className="p-3.5 rounded-lg bg-[#07080a] border border-[#363739] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#e6e6e6]">
              <Lock className="size-4 text-[#fbbf24] shrink-0" />
              <span><strong>PermissionRequestDialog</strong>: Autorización explícita requerida para escrituras en disco o terminal</span>
            </div>
            <span className="text-[10px] font-mono text-[#59d499] bg-[#59d499]/10 px-2 py-0.5 rounded border border-[#59d499]/30 shrink-0">
              HUMAN-IN-THE-LOOP
            </span>
          </div>
        </div>

        {/* Connector Line */}
        <div className="flex justify-center -my-1">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#040506] border border-[#363739] text-[11px] font-mono text-[#59d499]">
            <ArrowDown className="size-3 text-[#59d499]" />
            <span>Ejecución Validada y Contenida</span>
          </div>
        </div>

        {/* Layer 3: Sandbox & Vault Storage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl border border-[#363739] bg-[#111214] shadow-key">
            <div className="flex items-center gap-2 text-xs font-medium text-white mb-1.5">
              <FolderLock className="size-4 text-[#59d499]" />
              <span>Workspace Filesystem Sandbox</span>
            </div>
            <p className="text-xs text-[#9c9c9d] leading-relaxed">
              Límites estrictos dentro del directorio del proyecto activo. Sin acceso a rutas del sistema no autorizadas.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[#363739] bg-[#111214] shadow-key">
            <div className="flex items-center gap-2 text-xs font-medium text-white mb-1.5">
              <Key className="size-4 text-[#fbbf24]" />
              <span>Sparta Vault (AES-256-GCM)</span>
            </div>
            <p className="text-xs text-[#9c9c9d] leading-relaxed">
              Tokens de API y credenciales de servidores MCP cifrados localmente en el almacén seguro del sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 2. LangGraph Agentic Decision Flow Diagram ───────────────────────────────
export function LangGraphFlowDiagram() {
  return (
    <div className="my-8 rounded-2xl border border-[#363739] bg-[#07080a] p-5 sm:p-7 shadow-key overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#363739]/60 pb-3 mb-6 font-mono text-xs text-[#9c9c9d]">
        <span className="flex items-center gap-2 text-white">
          <Workflow className="size-4 text-[#63a1ff]" />
          Máquina de Estados Finitos (LangGraph + SQLite Checkpointing)
        </span>
        <span className="px-2 py-0.5 rounded bg-[#111214] border border-[#363739] text-[10px] text-[#63a1ff]">
          FSM ENGINE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center">
        {/* Step 1 */}
        <div className="p-4 rounded-xl border border-[#363739] bg-[#111214] flex flex-col justify-between shadow-key">
          <span className="font-mono text-[10px] text-[#6a6b6c] uppercase mb-2">Nodo 1 · Entrada</span>
          <div className="size-10 rounded-lg bg-[#1b1c1e] border border-[#363739] flex items-center justify-center mx-auto mb-3 text-[#e6e6e6]">
            <Bot className="size-5" />
          </div>
          <div className="text-xs font-medium text-white mb-1">Prompt &amp; Contexto</div>
          <div className="text-[11px] text-[#9c9c9d]">RAG local + Workspace State</div>
        </div>

        {/* Step 2 */}
        <div className="p-4 rounded-xl border border-[#363739] bg-[#111214] flex flex-col justify-between shadow-key">
          <span className="font-mono text-[10px] text-[#6a6b6c] uppercase mb-2">Nodo 2 · Plan</span>
          <div className="size-10 rounded-lg bg-[#1b1c1e] border border-[#363739] flex items-center justify-center mx-auto mb-3 text-[#63a1ff]">
            <Workflow className="size-5" />
          </div>
          <div className="text-xs font-medium text-white mb-1">Descomposición</div>
          <div className="text-[11px] text-[#9c9c9d]">Plan de acción incremental</div>
        </div>

        {/* Step 3 */}
        <div className="p-4 rounded-xl border border-[#ff6363]/40 bg-[#111214] flex flex-col justify-between shadow-key">
          <span className="font-mono text-[10px] text-[#ff6363] uppercase mb-2">Nodo 3 · Gate</span>
          <div className="size-10 rounded-lg bg-[#ff6363]/10 border border-[#ff6363]/30 flex items-center justify-center mx-auto mb-3 text-[#ff6363]">
            <Lock className="size-5" />
          </div>
          <div className="text-xs font-medium text-white mb-1">Modal de Permisos</div>
          <div className="text-[11px] text-[#ff6363]">Aprobación previa del usuario</div>
        </div>

        {/* Step 4 */}
        <div className="p-4 rounded-xl border border-[#363739] bg-[#111214] flex flex-col justify-between shadow-key">
          <span className="font-mono text-[10px] text-[#59d499] uppercase mb-2">Nodo 4 · Checkpoint</span>
          <div className="size-10 rounded-lg bg-[#59d499]/10 border border-[#59d499]/30 flex items-center justify-center mx-auto mb-3 text-[#59d499]">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="text-xs font-medium text-white mb-1">Ejecución &amp; Diff</div>
          <div className="text-[11px] text-[#9c9c9d]">Guardado SQLite inmutable</div>
        </div>
      </div>
    </div>
  );
}

// ── 3. Deep Research Flow Diagram ────────────────────────────────────────────
export function DeepResearchDiagram() {
  return (
    <div className="my-8 rounded-2xl border border-[#363739] bg-[#07080a] p-5 sm:p-7 shadow-key overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#363739]/60 pb-3 mb-6 font-mono text-xs text-[#9c9c9d]">
        <span className="flex items-center gap-2 text-white">
          <Search className="size-4 text-[#59d499]" />
          Flujo de Búsqueda Profunda (Deep Research Recursive Pipeline)
        </span>
        <span className="px-2 py-0.5 rounded bg-[#111214] border border-[#363739] text-[10px] text-[#59d499]">
          MULTI-HOP ENGINE
        </span>
      </div>

      <div className="space-y-3 font-mono text-xs">
        <div className="p-3.5 rounded-xl bg-[#111214] border border-[#363739] flex items-center justify-between">
          <span className="text-white">1. Intención del Usuario &amp; Desglose en 3-5 Subpreguntas</span>
          <span className="text-[#9c9c9d] text-[10px]">Planner</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-3 rounded-lg bg-[#040506] border border-[#363739] text-center">
            <span className="text-[#63a1ff] block mb-1">Docs Oficiales</span>
            <span className="text-[10px] text-[#6a6b6c]">RFCs &amp; Especificaciones</span>
          </div>
          <div className="p-3 rounded-lg bg-[#040506] border border-[#363739] text-center">
            <span className="text-[#59d499] block mb-1">Repositorios Git</span>
            <span className="text-[10px] text-[#6a6b6c]">Changelogs &amp; Issues</span>
          </div>
          <div className="p-3 rounded-lg bg-[#040506] border border-[#363739] text-center">
            <span className="text-[#fbbf24] block mb-1">Benchmarks</span>
            <span className="text-[10px] text-[#6a6b6c]">Métricas de Rendimiento</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#111214] border border-[#59d499]/30 flex items-center justify-between text-[#59d499]">
          <span>2. Síntesis Recursiva con Citas Canónicas y Tabla Comparativa</span>
          <span className="text-[10px] bg-[#59d499]/10 px-2 py-0.5 rounded border border-[#59d499]/30">
            VERIFICADO
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 4. Hybrid RAG Pipeline Diagram ───────────────────────────────────────────
export function HybridRagDiagram() {
  return (
    <div className="my-8 rounded-2xl border border-[#363739] bg-[#07080a] p-5 sm:p-7 shadow-key overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#363739]/60 pb-3 mb-6 font-mono text-xs text-[#9c9c9d]">
        <span className="flex items-center gap-2 text-white">
          <Database className="size-4 text-[#fbbf24]" />
          Pipeline RAG Local Híbrido (Vectorial + Léxico BM25)
        </span>
        <span className="px-2 py-0.5 rounded bg-[#111214] border border-[#363739] text-[10px] text-[#fbbf24]">
          SQLITE-VEC + FTS5
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Vectorial */}
        <div className="p-4 rounded-xl bg-[#111214] border border-[#363739] space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-[#63a1ff]">
            <Cpu className="size-4" />
            <span>Búsqueda Vectorial Semántica</span>
          </div>
          <p className="text-xs text-[#9c9c9d] leading-relaxed font-sans">
            Captura conceptos, similitudes y contexto semántico de documentos mediante embeddings locales sin enviar datos a la nube.
          </p>
        </div>

        {/* Lexical BM25 */}
        <div className="p-4 rounded-xl bg-[#111214] border border-[#363739] space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-[#59d499]">
            <Search className="size-4" />
            <span>Búsqueda Léxica FTS5 / BM25</span>
          </div>
          <p className="text-xs text-[#9c9c9d] leading-relaxed font-sans">
            Localiza nombres exactos de funciones, identificadores, códigos de error y variables críticas en el código fuente.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 5. MCP Architecture Diagram ──────────────────────────────────────────────
export function McpArchitectureDiagram() {
  return (
    <div className="my-8 rounded-2xl border border-[#363739] bg-[#07080a] p-5 sm:p-7 shadow-key overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#363739]/60 pb-3 mb-6 font-mono text-xs text-[#9c9c9d]">
        <span className="flex items-center gap-2 text-white">
          <Globe className="size-4 text-[#ff6363]" />
          Orquestación Multi-Servidor Model Context Protocol (MCP)
        </span>
        <span className="px-2 py-0.5 rounded bg-[#111214] border border-[#363739] text-[10px] text-[#ff6363]">
          JSON-RPC 2.0
        </span>
      </div>

      <div className="p-4 rounded-xl bg-[#111214] border border-[#363739] text-center mb-3">
        <span className="text-xs font-medium text-white">Sparta Agent Core (MCP Client Host)</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono text-xs">
        <div className="p-3 rounded-lg bg-[#040506] border border-[#363739] text-[#e6e6e6]">
          <span>Filesystem</span>
          <span className="block text-[9px] text-[#6a6b6c] mt-1">stdio</span>
        </div>
        <div className="p-3 rounded-lg bg-[#040506] border border-[#363739] text-[#63a1ff]">
          <span>PostgreSQL</span>
          <span className="block text-[9px] text-[#6a6b6c] mt-1">dbhub</span>
        </div>
        <div className="p-3 rounded-lg bg-[#040506] border border-[#363739] text-[#59d499]">
          <span>GitHub &amp; Git</span>
          <span className="block text-[9px] text-[#6a6b6c] mt-1">api.github.com</span>
        </div>
        <div className="p-3 rounded-lg bg-[#040506] border border-[#363739] text-[#ff6363]">
          <span>Notion &amp; Slack</span>
          <span className="block text-[9px] text-[#6a6b6c] mt-1">OAuth2 HTTP</span>
        </div>
      </div>
    </div>
  );
}
