/** Catalogo curado de servidores MCP.
 *  Fuente de verdad: sparta_mcp_catalog.json (usado por Python/mcp_manage_tool).
 *  Este archivo se mantiene sincronizado manualmente con el JSON.
 *  Solo el agente puede instalar servidores listados aqui. */
export interface CatalogEntry {
  name: string
  description: string
  type: 'stdio' | 'http'
  command?: string
  args?: string[]
  url?: string
  env_required?: string[]
  headers_required?: string[]
  notes?: string
  docs_url?: string
  vendor?: string
}

export const MCP_CATALOG: Record<string, CatalogEntry> = {
  github: {
    name: 'GitHub',
    description: 'Acceso a repositorios, issues, pull requests y más de GitHub',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env_required: ['GITHUB_TOKEN'],
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    vendor: 'github',
  },
  filesystem: {
    name: 'Filesystem',
    description: 'Acceso controlado al sistema de archivos local (requiere ruta permitida)',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '${DIR}'],
    notes: 'Requiere especificar un directorio permitido.',
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    vendor: 'filesystem',
  },
  notion: {
    name: 'Notion',
    description: 'Lectura y búsqueda en páginas y bases de datos de Notion',
    type: 'http',
    url: 'https://mcp.notion.com/mcp',
    headers_required: ['Authorization'],
    docs_url: 'https://developers.notion.com/docs/authorization',
    vendor: 'notion',
  },
  postgres: {
    name: 'PostgreSQL',
    description: 'Consulta y análisis de bases de datos PostgreSQL',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', '${DATABASE_URL}'],
    notes: 'Requiere DATABASE_URL.',
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    vendor: 'postgresql',
  },
  sqlite: {
    name: 'SQLite',
    description: 'Consulta y análisis de bases de datos SQLite locales',
    type: 'stdio',
    command: 'uvx',
    args: ['mcp-server-sqlite', '--db', '${DB_PATH}'],
    notes: 'Requiere ruta a archivo .db.',
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
    vendor: 'sqlite',
  },
  puppeteer: {
    name: 'Puppeteer',
    description: 'Navegación web automatizada, capturas y extracción de contenido',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
    vendor: 'puppeteer',
  },
}

export function catalogToMarketplaceItems() {
  return Object.entries(MCP_CATALOG).map(([id, entry]) => ({
    id,
    name: entry.name,
    description: entry.description,
    type: entry.type,
    cmd: entry.command
      ? `${entry.command} ${(entry.args ?? []).join(' ')}`
      : entry.url ?? '',
    category: _inferCategory(entry),
    env_required: entry.env_required ?? [],
    headers_required: entry.headers_required ?? [],
    notes: entry.notes,
    docs_url: entry.docs_url,
    vendor: entry.vendor,
  }))
}

function _inferCategory(entry: CatalogEntry): string {
  const name = entry.name.toLowerCase()
  if (name.includes('git')) return 'DevTools'
  if (name.includes('sql') || name.includes('postgres')) return 'Database'
  if (name.includes('puppeteer') || name.includes('brave') || name.includes('search')) return 'Web'
  if (name.includes('filesystem') || name.includes('storage')) return 'Storage'
  if (name.includes('notion')) return 'Productivity'
  return 'Other'
}
