import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export interface DocPageItem {
  name: string;
  slug: string;
  category: string;
}

export const ORDERED_DOC_PAGES: DocPageItem[] = [
  { name: 'Introducción', slug: 'inicio', category: 'General' },
  { name: 'Inicio Rápido', slug: 'instalacion', category: 'Primeros Pasos' },
  { name: 'Modo Chat vs Modo Agente', slug: 'modos', category: 'Conceptos' },
  { name: 'Seguridad y Sandbox', slug: 'permisos', category: 'Conceptos' },
  { name: 'Modelos y Proveedores', slug: 'proveedores', category: 'Conceptos' },
  { name: 'Búsqueda Profunda (Deep Research)', slug: 'deep-research', category: 'Funciones' },
  { name: 'RAG Local Híbrido Multimodal', slug: 'rag-multimodal', category: 'Funciones' },
  { name: 'Recipe Studio y Data Recipes', slug: 'recipe-studio', category: 'Funciones' },
  { name: 'Monitor de APIs, Tokens y Costos', slug: 'api-monitor', category: 'Funciones' },
  { name: 'Acceso Remoto, LAN y Puente GPU', slug: 'remote-access', category: 'Funciones' },
  { name: 'Entrada de Voz y Whisper', slug: 'voice-audio', category: 'Funciones' },
  { name: 'Gestión de Archivos y Adjuntos', slug: 'adjuntos', category: 'Funciones' },
  { name: 'Herramientas en Vivo y Subagentes', slug: 'herramientas', category: 'Funciones' },
  { name: 'Ejecución de Código y Terminal', slug: 'terminal', category: 'Funciones' },
  { name: 'Arquitectura del Frontend', slug: 'arquitectura', category: 'Arquitectura' },
  { name: 'Backend y Rust Sidecar', slug: 'architecture/backend-architecture', category: 'Arquitectura' },
  { name: 'Puente IPC Seguro', slug: 'architecture/ipc-bridge', category: 'Arquitectura' },
  { name: 'Introducción a MCP', slug: 'mcp', category: 'Model Context Protocol' },
  { name: 'Configuración de Servidores MCP', slug: 'mcp/configuration', category: 'Model Context Protocol' },
  { name: 'Servidores MCP Soportados', slug: 'mcp/supported-servers', category: 'Model Context Protocol' },
  { name: 'Skills y Reglas de Proyecto', slug: 'skills', category: 'Skills' },
];

export const LEGACY_SLUG_MAP: Record<string, string> = {
  inicio: 'inicio',
  index: 'inicio',
  instalacion: 'instalacion',
  quickstart: 'instalacion',
  'desarrollo-local': 'instalacion',
  modos: 'modos',
  'core-concepts/chat-vs-agent-mode': 'modos',
  permisos: 'permisos',
  'core-concepts/security-and-sandbox': 'permisos',
  proveedores: 'proveedores',
  'core-concepts/models-and-providers': 'proveedores',
  arquitectura: 'arquitectura',
  'architecture/frontend-ui': 'arquitectura',
  'architecture/backend-architecture': 'architecture/backend-architecture',
  'architecture/ipc-bridge': 'architecture/ipc-bridge',
  terminal: 'terminal',
  'features/code-execution': 'terminal',
  'deep-research': 'deep-research',
  'features/deep-research': 'deep-research',
  'rag-multimodal': 'rag-multimodal',
  'features/multimodal-rag': 'rag-multimodal',
  'recipe-studio': 'recipe-studio',
  'features/recipe-studio': 'recipe-studio',
  'api-monitor': 'api-monitor',
  'features/api-monitor': 'api-monitor',
  'remote-access': 'remote-access',
  'features/remote-access': 'remote-access',
  'voice-audio': 'voice-audio',
  'features/voice-audio': 'voice-audio',
  adjuntos: 'adjuntos',
  'features/attachments-and-files': 'adjuntos',
  herramientas: 'herramientas',
  'features/live-tools': 'herramientas',
  mcp: 'mcp',
  'mcp/introduction': 'mcp',
  'mcp/configuration': 'mcp/configuration',
  'mcp/supported-servers': 'mcp/supported-servers',
  skills: 'skills',
  'skills/overview': 'skills',
};

interface DocsPaginationProps {
  currentSlug: string;
  onNavigate: (slug: string) => void;
}

export function DocsPagination({ currentSlug, onNavigate }: DocsPaginationProps) {
  const normalizedSlug = LEGACY_SLUG_MAP[currentSlug] || currentSlug;
  const currentIndex = ORDERED_DOC_PAGES.findIndex(
    (p) => p.slug === normalizedSlug || p.slug === currentSlug
  );

  const prev = currentIndex > 0 ? ORDERED_DOC_PAGES[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < ORDERED_DOC_PAGES.length - 1
      ? ORDERED_DOC_PAGES[currentIndex + 1]
      : null;

  if (!prev && !next) return null;

  return (
    <div className="mt-14 pt-8 border-t border-[#363739] grid grid-cols-1 sm:grid-cols-2 gap-4 select-none">
      {/* Previous Card */}
      {prev ? (
        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate(prev.slug)}
          className="p-4 rounded-xl border border-[#363739] bg-[#07080a] hover:border-white/30 hover:bg-[#111214] shadow-key transition-all group cursor-pointer flex flex-col justify-between text-left"
        >
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#6a6b6c] uppercase tracking-wider mb-1">
            <ChevronLeft className="size-3 text-[#9c9c9d] group-hover:-translate-x-1 transition-transform" />
            <span>Anterior · {prev.category}</span>
          </div>
          <span className="text-sm font-medium text-[#e6e6e6] group-hover:text-white transition-colors">
            {prev.name}
          </span>
        </motion.div>
      ) : (
        <div />
      )}

      {/* Next Card */}
      {next ? (
        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate(next.slug)}
          className="p-4 rounded-xl border border-[#363739] bg-[#07080a] hover:border-white/30 hover:bg-[#111214] shadow-key transition-all group cursor-pointer flex flex-col justify-between text-right sm:col-start-2"
        >
          <div className="flex items-center justify-end gap-1.5 font-mono text-[10px] text-[#6a6b6c] uppercase tracking-wider mb-1">
            <span>Siguiente · {next.category}</span>
            <ChevronRight className="size-3 text-[#9c9c9d] group-hover:translate-x-1 transition-transform" />
          </div>
          <span className="text-sm font-medium text-[#e6e6e6] group-hover:text-white transition-colors">
            {next.name}
          </span>
        </motion.div>
      ) : null}
    </div>
  );
}
