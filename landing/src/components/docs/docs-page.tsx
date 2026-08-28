import React, { useState, useEffect, lazy, Suspense, useMemo, type ComponentType } from 'react';
import { DocsBody, DocsDescription, DocsPage as FumadocsPage, DocsTitle } from 'fumadocs-ui/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { Root } from 'fumadocs-core/page-tree';
import { DocsPagination } from './docs-pagination';

const documents = import.meta.glob('./content/pages/**/*.mdx');
const legacySlugs: Record<string, string> = {
  inicio: 'index',
  instalacion: 'quickstart',
  'desarrollo-local': 'quickstart',
  modos: 'core-concepts/chat-vs-agent-mode',
  permisos: 'core-concepts/security-and-sandbox',
  proveedores: 'core-concepts/models-and-providers',
  arquitectura: 'architecture/frontend-ui',
  terminal: 'features/code-execution',
  'deep-research': 'features/deep-research',
  'rag-multimodal': 'features/multimodal-rag',
  'recipe-studio': 'features/recipe-studio',
  'api-monitor': 'features/api-monitor',
  'remote-access': 'features/remote-access',
  'voice-audio': 'features/voice-audio',
  adjuntos: 'features/attachments-and-files',
  herramientas: 'features/live-tools',
  mcp: 'mcp/introduction',
  skills: 'skills/overview',
};
const href = (slug: string) => `?docs=${slug}`;
const page = (name: string, slug: string) => ({ type: 'page' as const, name, url: href(slug) });
const tree: Root = {
  name: 'Sparta Agent',
  children: [
    page('Introducción', 'inicio'),
    {
      type: 'folder',
      name: 'Primeros pasos',
      defaultOpen: true,
      children: [page('Inicio rápido', 'instalacion')],
    },
    {
      type: 'folder',
      name: 'Conceptos',
      children: [
        page('Chat y modo agente', 'modos'),
        page('Seguridad y sandbox', 'permisos'),
        page('Modelos y proveedores', 'proveedores'),
      ],
    },
    {
      type: 'folder',
      name: 'Funciones',
      children: [
        page('Deep Research', 'deep-research'),
        page('RAG multimodal', 'rag-multimodal'),
        page('Recipe Studio & Recipes', 'recipe-studio'),
        page('Monitor de APIs y Costos', 'api-monitor'),
        page('Acceso Remoto & GPU Colab', 'remote-access'),
        page('Entrada de Voz y Whisper', 'voice-audio'),
        page('Adjuntos y archivos', 'adjuntos'),
        page('Herramientas en vivo', 'herramientas'),
        page('Ejecución de código', 'terminal'),
      ],
    },
    {
      type: 'folder',
      name: 'Arquitectura',
      children: [
        page('Frontend', 'arquitectura'),
        page('Backend y Sidecar', 'architecture/backend-architecture'),
        page('Puente IPC', 'architecture/ipc-bridge'),
      ],
    },
    {
      type: 'folder',
      name: 'MCP',
      children: [
        page('Introducción', 'mcp'),
        page('Configuración', 'mcp/configuration'),
        page('Servidores soportados', 'mcp/supported-servers'),
      ],
    },
    { type: 'folder', name: 'Skills', children: [page('Visión general', 'skills')] },
  ],
};

import {
  SecurityIsolationDiagram,
  LangGraphFlowDiagram,
  DeepResearchDiagram,
  HybridRagDiagram,
  McpArchitectureDiagram,
} from './diagrams/architectural-diagrams';

const customMdxComponents = {
  ...defaultMdxComponents,
  SecurityIsolationDiagram,
  LangGraphFlowDiagram,
  DeepResearchDiagram,
  HybridRagDiagram,
  McpArchitectureDiagram,
};

export function DocsPage({ onBackToLanding }: { onBackToLanding?: () => void }) {
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('docs') || 'inicio';
    }
    return 'inicio';
  });

  useEffect(() => {
    const handlePopState = () => {
      const slug = new URLSearchParams(window.location.search).get('docs') || 'inicio';
      setCurrentPage(slug);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToDoc = (slug: string) => {
    window.history.pushState(null, '', `?docs=${slug}`);
    setCurrentPage(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const documentPath = `./content/pages/${legacySlugs[currentPage] ?? currentPage}.mdx`;
  const loader = documents[documentPath];
  const MDX = useMemo(() => lazy<ComponentType<{ components?: unknown }>>(async () => {
    if (!loader) return { default: () => <p className="text-white p-6">Documento no encontrado.</p> };
    const module = await loader() as { default: ComponentType<{ components?: unknown }> };
    return { default: module.default };
  }), [loader]);

  const handleGlobalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('a');
    if (!target) return;
    const href = target.getAttribute('href');
    if (href && href.startsWith('?docs=')) {
      e.preventDefault();
      const slug = href.replace('?docs=', '');
      navigateToDoc(slug);
    }
  };

  return (
    <div className="min-h-screen bg-[#040506] text-white" onClick={handleGlobalClick}>
      <DocsLayout
        tree={tree}
        nav={{
          title: (
            <div
              onClick={onBackToLanding}
              className="flex items-center gap-2.5 cursor-pointer select-none group"
            >
              <img
                src="/favicon.svg"
                alt="Sparta Agent Logo"
                className="size-6 object-contain drop-shadow-[0_0_8px_rgba(234,179,8,0.4)] group-hover:scale-105 transition-transform"
              />
              <span className="font-medium text-sm text-white tracking-tight">Sparta Agent</span>
            </div>
          ),
          url: '#',
          enabled: true,
        }}
        links={[
          { text: '← Volver a la Landing', url: '/' },
          { text: 'GitHub', url: 'https://github.com/Naiker12/Sparta-Agent', external: true },
        ]}
      >
        <main className="min-w-0">
          <FumadocsPage>
            <DocsBody>
              <Suspense fallback={<p className="text-[#9c9c9d] text-sm">Cargando documentación…</p>}>
                <MDX components={customMdxComponents} />
              </Suspense>
              <DocsPagination currentSlug={currentPage} onNavigate={navigateToDoc} />
            </DocsBody>
          </FumadocsPage>
        </main>
      </DocsLayout>
    </div>
  );
}
