import { lazy, Suspense, useMemo, type ComponentType } from 'react';
import { DocsBody, DocsDescription, DocsPage as FumadocsPage, DocsTitle } from 'fumadocs-ui/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { Root } from 'fumadocs-core/page-tree';
const documents = import.meta.glob('./content/pages/**/*.mdx');
const legacySlugs: Record<string, string> = { inicio: 'index', instalacion: 'quickstart', 'desarrollo-local': 'quickstart', modos: 'core-concepts/chat-vs-agent-mode', permisos: 'core-concepts/security-and-sandbox', proveedores: 'core-concepts/models-and-providers', arquitectura: 'architecture/frontend-ui', terminal: 'features/code-execution', 'deep-research': 'features/deep-research', 'rag-multimodal': 'features/multimodal-rag', adjuntos: 'features/attachments-and-files', herramientas: 'features/live-tools', mcp: 'mcp/introduction', skills: 'skills/overview' };
const href = (slug: string) => `?docs=${slug}`;
const page = (name: string, slug: string) => ({ type: 'page' as const, name, url: href(slug) });
const tree: Root = { name: 'Sparta Agent', children: [
  page('Introducción', 'inicio'),
  { type: 'folder', name: 'Primeros pasos', defaultOpen: true, children: [page('Inicio rápido', 'instalacion')] },
  { type: 'folder', name: 'Conceptos', children: [page('Chat y modo agente', 'modos'), page('Seguridad y sandbox', 'permisos'), page('Modelos y proveedores', 'proveedores')] },
  { type: 'folder', name: 'Funciones', children: [page('Deep Research', 'deep-research'), page('RAG multimodal', 'rag-multimodal'), page('Adjuntos y archivos', 'adjuntos'), page('Herramientas en vivo', 'herramientas'), page('Ejecución de código', 'terminal')] },
  { type: 'folder', name: 'Arquitectura', children: [page('Frontend', 'arquitectura'), page('Backend', 'architecture/backend-architecture'), page('Puente IPC', 'architecture/ipc-bridge')] },
  { type: 'folder', name: 'MCP', children: [page('Introducción', 'mcp'), page('Configuración', 'mcp/configuration'), page('Servidores soportados', 'mcp/supported-servers')] },
  { type: 'folder', name: 'Skills', children: [page('Visión general', 'skills')] },
] };

export function DocsPage({ onBackToLanding }: { onBackToLanding?: () => void }) {
  const currentPage = new URLSearchParams(window.location.search).get('docs') || 'inicio';
  const documentPath = `./content/pages/${legacySlugs[currentPage] ?? currentPage}.mdx`;
  const loader = documents[documentPath];
  const MDX = useMemo(() => lazy<ComponentType<{ components?: unknown }>>(async () => {
    if (!loader) return { default: () => <p>Documento no encontrado.</p> };
    const module = await loader() as { default: ComponentType<{ components?: unknown }> };
    return { default: module.default };
  }), [loader]);
  return (
    <DocsLayout tree={tree} nav={{ title: 'Sparta Agent', url: '/', enabled: true }} links={[{ text: 'GitHub', url: 'https://github.com/Naiker12/Sparta-Agent', external: true }]}>
      <main className="min-w-0">
          <FumadocsPage>
            <DocsTitle>Sparta Agent</DocsTitle>
            <DocsDescription>Documentación técnica y guías de producto.</DocsDescription>
            <DocsBody><Suspense fallback={<p>Cargando documentación…</p>}><MDX components={defaultMdxComponents} /></Suspense></DocsBody>
          </FumadocsPage>
      </main>
    </DocsLayout>
  );
}
