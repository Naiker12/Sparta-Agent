export interface NavItem {
  label: string;
  slug: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    title: 'Primeros pasos',
    items: [
      { label: 'Visión general', slug: 'inicio' },
      { label: 'Instalación', slug: 'instalacion' },
      { label: 'Desarrollo local', slug: 'desarrollo-local' },
    ],
  },
  {
    title: 'Seguridad y Modos',
    items: [
      { label: 'Modo Chat vs Agente', slug: 'modos' },
      { label: 'Permisos y límites', slug: 'permisos' },
      { label: 'Vault de credenciales', slug: 'vault' },
    ],
  },
  {
    title: 'Capacidades Clave',
    items: [
      { label: 'Deep Research', slug: 'deep-research' },
      { label: 'RAG Multimodal', slug: 'rag-multimodal' },
      { label: 'Gestión de Adjuntos', slug: 'adjuntos' },
      { label: 'Herramientas en vivo', slug: 'herramientas' },
      { label: 'Terminal y Python', slug: 'terminal' },
    ],
  },
  {
    title: 'Ecosistema',
    items: [
      { label: 'Servidores MCP', slug: 'mcp' },
      { label: 'Skills', slug: 'skills' },
      { label: 'Proveedores de IA', slug: 'proveedores' },
    ],
  },
  {
    title: 'Arquitectura',
    items: [
      { label: 'Arquitectura del sistema', slug: 'arquitectura' },
      { label: 'Agentes y tareas', slug: 'agentes' },
    ],
  },
];
