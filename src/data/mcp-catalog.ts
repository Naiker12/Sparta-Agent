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
  /** Whether this server package is actively maintained. false = archived by upstream. */
  maintained?: boolean
}

export const MCP_CATALOG: Record<string, CatalogEntry> = {
  github: {
    name: 'GitHub',
    description: 'Acceso a repositorios, issues, pull requests y más de GitHub',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env_required: ['GITHUB_TOKEN'],
    notes: 'Paquete archivado por MCP. Usar github/github-mcp-server (HTTP remoto) como alternativa.',
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    vendor: 'github',
    maintained: false,
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
    maintained: true,
  },
  notion: {
    name: 'Notion',
    description: 'Lectura y búsqueda en páginas y bases de datos de Notion',
    type: 'http',
    url: 'https://mcp.notion.com/mcp',
    headers_required: ['Authorization'],
    docs_url: 'https://developers.notion.com/docs/authorization',
    vendor: 'notion',
    maintained: true,
  },
  postgres: {
    name: 'PostgreSQL',
    description: 'Consulta y análisis de bases de datos PostgreSQL',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', '${DATABASE_URL}'],
    notes: 'Paquete archivado por MCP. Requiere DATABASE_URL.',
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    vendor: 'postgresql',
    maintained: false,
  },
  sqlite: {
    name: 'SQLite',
    description: 'Consulta y análisis de bases de datos SQLite locales',
    type: 'stdio',
    command: 'uvx',
    args: ['mcp-server-sqlite', '--db', '${DB_PATH}'],
    notes: 'Paquete archivado por MCP. Requiere ruta a archivo .db.',
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
    vendor: 'sqlite',
    maintained: false,
  },
  puppeteer: {
    name: 'Puppeteer',
    description: 'Navegación web automatizada, capturas y extracción de contenido',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    notes: 'Paquete archivado por MCP.',
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
    vendor: 'puppeteer',
    maintained: false,
  },
  fetch: {
    name: 'Fetch',
    description: 'Obtención de contenido web con conversión a markdown (útil para RAG)',
    type: 'stdio',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    vendor: 'fetch',
    maintained: true,
  },
  git: {
    name: 'Git',
    description: 'Operaciones git estructuradas: diff, log, status, blame, branches',
    type: 'stdio',
    command: 'uvx',
    args: ['mcp-server-git', '--repository', '${REPO_DIR}'],
    notes: 'Requiere la ruta al repositorio git.',
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
    vendor: 'git',
    maintained: true,
  },
  memory: {
    name: 'Memory',
    description: 'Knowledge graph en memoria para recall de contexto entre sesiones',
    type: 'stdio',
    command: 'uvx',
    args: ['mcp-server-memory'],
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    vendor: 'memory',
    maintained: true,
  },
  time: {
    name: 'Time',
    description: 'Zona horaria y hora actual del sistema',
    type: 'stdio',
    command: 'uvx',
    args: ['mcp-server-time'],
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
    vendor: 'time',
    maintained: true,
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
    maintained: entry.maintained,
  }))
}

function _inferCategory(entry: CatalogEntry): string {
  const name = entry.name.toLowerCase()
  if (name.includes('git')) return 'DevTools'
  if (name.includes('sql') || name.includes('postgres')) return 'Database'
  if (name.includes('puppeteer') || name.includes('brave') || name.includes('search') || name.includes('fetch')) return 'Web'
  if (name.includes('filesystem') || name.includes('storage')) return 'Storage'
  if (name.includes('notion')) return 'Productivity'
  if (name.includes('memory')) return 'Knowledge'
  if (name.includes('time')) return 'Utility'
  return 'Other'
}
