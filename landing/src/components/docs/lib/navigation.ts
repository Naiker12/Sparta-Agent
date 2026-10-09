export const legacySlugs: Record<string, string> = {
  inicio: 'index', instalacion: 'quickstart', 'desarrollo-local': 'quickstart',
  modos: 'core-concepts/chat-vs-agent-mode', permisos: 'core-concepts/security-and-sandbox',
  proveedores: 'core-concepts/models-and-providers', arquitectura: 'architecture/frontend-ui',
  terminal: 'features/code-execution', 'deep-research': 'features/deep-research',
  'rag-multimodal': 'features/multimodal-rag', 'recipe-studio': 'features/recipe-studio',
  'api-monitor': 'features/api-monitor', 'remote-access': 'features/remote-access',
  'voice-audio': 'features/voice-audio', adjuntos: 'features/attachments-and-files',
  herramientas: 'features/live-tools', mcp: 'mcp/introduction', skills: 'skills/overview',
};
export const canonicalSlug = (slug: string) => legacySlugs[slug] ?? slug;
export const docsPath = (slug: string) => `/docs/${canonicalSlug(slug)}`;
export const docsHref = (slug: string) => `${import.meta.env.BASE_URL}?docs=${encodeURIComponent(canonicalSlug(slug))}`;
export const groups = [
  { title: 'Conoce el proyecto', pages: ['index', 'project/status-and-scope'] },
  { title: 'Primeros pasos', pages: ['quickstart', 'guides/first-task', 'guides/workspace'] },
  { title: 'Conversaciones', pages: ['core-concepts/chat-vs-agent-mode', 'core-concepts/models-and-providers', 'features/attachments-and-files', 'features/multimodal-rag', 'features/deep-research'] },
  { title: 'Integraciones', pages: ['features/channels', 'features/live-tools', 'features/code-execution', 'mcp/introduction', 'mcp/configuration', 'mcp/supported-servers', 'skills/overview'] },
  { title: 'Configuración', pages: ['core-concepts/security-and-sandbox', 'features/api-monitor', 'features/voice-audio', 'features/remote-access', 'features/recipe-studio', 'guides/performance', 'guides/troubleshooting'] },
  { title: 'Arquitectura', pages: ['architecture/overview', 'architecture/frontend-ui', 'architecture/backend-architecture', 'architecture/ipc-bridge'] },
  { title: 'Desarrollo', pages: ['development/local-setup', 'development/project-structure'] },
];
