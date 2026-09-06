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
  { title: 'Empieza aquí', pages: ['index', 'quickstart', 'guides/first-task'] },
  { title: 'Trabaja con Sparta', pages: ['core-concepts/chat-vs-agent-mode', 'core-concepts/models-and-providers', 'features/attachments-and-files', 'features/code-execution', 'features/live-tools'] },
  { title: 'Conocimiento e investigación', pages: ['features/multimodal-rag', 'features/deep-research', 'skills/overview'] },
  { title: 'Conecta tus herramientas', pages: ['mcp/introduction', 'mcp/configuration', 'mcp/supported-servers'] },
  { title: 'Configura y resuelve', pages: ['core-concepts/security-and-sandbox', 'guides/troubleshooting', 'guides/performance', 'features/remote-access', 'features/api-monitor', 'features/voice-audio', 'features/recipe-studio'] },
  { title: 'Para desarrolladores', pages: ['architecture/frontend-ui', 'architecture/backend-architecture', 'architecture/ipc-bridge'] },
];
