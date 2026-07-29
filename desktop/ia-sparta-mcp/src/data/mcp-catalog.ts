import type { MCPAuthType } from 'ia-sparta-core'
import { getVendorForServer as _getVendor } from 'ia-sparta-core'

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
  maintained?: boolean
  auth_type: MCPAuthType
  category: string
}

export const MCP_CATALOG: Record<string, CatalogEntry> = {
  // ── DevTools ────────────────────────────────────────────────
  github: {
    name: 'GitHub',
    description: 'Acceso a repositorios, issues, pull requests y más de GitHub (HTTP remoto oficial)',
    type: 'http',
    url: 'https://api.github.com/mcp',
    env_required: ['GITHUB_TOKEN'],
    notes: 'Usa el servidor HTTP remoto oficial de GitHub. También funciona con OAuth.',
    docs_url: 'https://github.com/github/github-mcp-server',
    vendor: 'github',
    maintained: true,
    auth_type: 'api_key',
    category: 'DevTools',
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
    auth_type: 'none',
    category: 'DevTools',
  },
  // ── Storage ─────────────────────────────────────────────────
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
    auth_type: 'none',
    category: 'Storage',
  },
  'google-drive': {
    name: 'Google Drive',
    description: 'Acceso a archivos y documentos en Google Drive',
    type: 'http',
    url: 'https://workspace-mcp.googleapis.com/mcp',
    notes: 'Requiere autenticación OAuth con cuenta Google. Scopes de solo lectura por defecto.',
    docs_url: 'https://developers.google.com/workspace/guides/configure-mcp-servers',
    vendor: 'google',
    maintained: true,
    auth_type: 'oauth2',
    category: 'Storage',
  },
  onedrive: {
    name: 'OneDrive / SharePoint',
    description: 'Acceso a archivos en OneDrive y SharePoint Online',
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'ms-365-mcp-server'],
    notes: 'Usa OAuth con dispositivo/navegador. Alternativa a Agent 365 (requiere licencia Copilot).',
    docs_url: 'https://github.com/Softeria/ms-365-mcp-server',
    vendor: 'microsoft',
    maintained: true,
    auth_type: 'oauth2',
    category: 'Storage',
  },
  // ── Database ────────────────────────────────────────────────
  supabase: {
    name: 'Supabase',
    description: 'Consulta y administración de bases de datos Supabase (PostgreSQL + API)',
    type: 'http',
    url: 'https://mcp.supabase.com/mcp',
    notes: 'OAuth 2.1 + PKCE + registro dinámico de cliente.',
    docs_url: 'https://supabase.com/docs/guides/ai-tools/mcp',
    vendor: 'supabase',
    maintained: true,
    auth_type: 'oauth2',
    category: 'Database',
  },
  dbhub: {
    name: 'DBHub (Postgres/MySQL/SQLite)',
    description: 'Un solo servidor para PostgreSQL, MySQL y SQLite (reemplaza los paquetes archivados)',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@bytebase/dbhub', '--dsn', '${DATABASE_URL}'],
    notes: 'Usa una connection string. Soporta PostgreSQL, MySQL y SQLite.',
    docs_url: 'https://github.com/bytebase/dbhub',
    vendor: 'database',
    maintained: true,
    auth_type: 'api_key',
    category: 'Database',
  },
  mongodb: {
    name: 'MongoDB',
    description: 'Consulta y análisis de bases de datos MongoDB',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@mongodb-js/mongodb-mcp-server', '--connection-string', '${MONGODB_URI}'],
    notes: 'Servidor oficial de MongoDB. Requiere connection string.',
    docs_url: 'https://github.com/mongodb-js/mongodb-mcp-server',
    vendor: 'mongodb',
    maintained: true,
    auth_type: 'api_key',
    category: 'Database',
  },
  // ── Productivity ────────────────────────────────────────────
  notion: {
    name: 'Notion',
    description: 'Lectura y búsqueda en páginas y bases de datos de Notion',
    type: 'http',
    url: 'https://mcp.notion.com/mcp',
    headers_required: ['Authorization'],
    docs_url: 'https://developers.notion.com/docs/authorization',
    vendor: 'notion',
    maintained: true,
    auth_type: 'oauth2',
    category: 'Productivity',
  },
  gmail: {
    name: 'Gmail',
    description: 'Lectura y envío de correos electrónicos en Gmail',
    type: 'http',
    url: 'https://gmail-mcp.googleapis.com/mcp',
    notes: 'Requiere proyecto en Google Cloud + pantalla de consentimiento OAuth. Scopes readonly por defecto.',
    docs_url: 'https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server',
    vendor: 'google',
    maintained: true,
    auth_type: 'oauth2',
    category: 'Productivity',
  },
  'google-calendar': {
    name: 'Google Calendar',
    description: 'Lectura y gestión de eventos en Google Calendar',
    type: 'http',
    url: 'https://calendar-mcp.googleapis.com/mcp',
    notes: 'Comparte OAuth con otros servicios de Google Workspace si el usuario lo permite.',
    docs_url: 'https://developers.google.com/workspace/guides/configure-mcp-servers',
    vendor: 'google',
    maintained: true,
    auth_type: 'oauth2',
    category: 'Productivity',
  },
  // ── Comunicación ────────────────────────────────────────────
  slack: {
    name: 'Slack',
    description: 'Lectura y envío de mensajes en Slack',
    type: 'http',
    url: 'https://mcp.slack.com/mcp',
    notes: 'Login con workspace de Slack. Scopes de lectura por defecto.',
    docs_url: 'https://api.slack.com/mcp',
    vendor: 'slack',
    maintained: true,
    auth_type: 'oauth2',
    category: 'Comunicación',
  },
  // ── Diseño ──────────────────────────────────────────────────
  figma: {
    name: 'Figma',
    description: 'Acceso al contexto de diseño de Figma para agentes',
    type: 'http',
    url: 'https://mcp.figma.com/mcp',
    docs_url: 'https://www.figma.com/developers/mcp',
    vendor: 'figma',
    maintained: true,
    auth_type: 'oauth2',
    category: 'Diseño',
  },
  // ── Pagos ───────────────────────────────────────────────────
  stripe: {
    name: 'Stripe',
    description: 'Consulta de pagos, clientes y suscripciones en Stripe',
    type: 'http',
    url: 'https://mcp.stripe.com/mcp',
    notes: 'Usa una clave restringida (nunca la clave live completa).',
    docs_url: 'https://docs.stripe.com/mcp',
    vendor: 'stripe',
    maintained: true,
    auth_type: 'api_key',
    category: 'Pagos',
  },
  // ── Monitoreo ───────────────────────────────────────────────
  sentry: {
    name: 'Sentry',
    description: 'Consulta de issues, errores y rendimiento en Sentry',
    type: 'http',
    url: 'https://mcp.sentry.dev/mcp',
    docs_url: 'https://docs.sentry.io/mcp/',
    vendor: 'sentry',
    maintained: true,
    auth_type: 'oauth2',
    category: 'Monitoreo',
  },
  // ── Web ─────────────────────────────────────────────────────
  fetch: {
    name: 'Fetch',
    description: 'Obtención de contenido web con conversión a markdown (útil para RAG)',
    type: 'stdio',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    vendor: 'fetch',
    maintained: true,
    auth_type: 'none',
    category: 'Web',
  },
  playwright: {
    name: 'Playwright',
    description: 'Navegación web automatizada, capturas y extracción de contenido (reemplaza Puppeteer)',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp'],
    notes: 'Reemplaza el paquete archivado de Puppeteer.',
    docs_url: 'https://github.com/microsoft/playwright-mcp',
    vendor: 'playwright',
    maintained: true,
    auth_type: 'none',
    category: 'Web',
  },
  'chrome-devtools': {
    name: 'Chrome DevTools MCP',
    description: 'Inspección real de una pestaña de Chrome: DOM, consola, red, rendimiento',
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp'],
    notes: 'Requiere Chrome abierto con --remote-debugging-port.',
    docs_url: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
    vendor: 'chrome',
    maintained: true,
    auth_type: 'none',
    category: 'Web',
  },
  // ── Conocimiento ────────────────────────────────────────────
  memory: {
    name: 'Memory',
    description: 'Knowledge graph en memoria para recall de contexto entre sesiones',
    type: 'stdio',
    command: 'uvx',
    args: ['mcp-server-memory'],
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    vendor: 'memory',
    maintained: true,
    auth_type: 'none',
    category: 'Knowledge',
  },
  // ── Utilidad ────────────────────────────────────────────────
  time: {
    name: 'Time',
    description: 'Zona horaria y hora actual del sistema',
    type: 'stdio',
    command: 'uvx',
    args: ['mcp-server-time'],
    docs_url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
    vendor: 'time',
    maintained: true,
    auth_type: 'none',
    category: 'Utility',
  },
}

export function getVendorForServer(serverId: string): string | undefined {
  return MCP_CATALOG[serverId]?.vendor ?? _getVendor(serverId)
}

export function getAuthTypeForServer(serverId: string): MCPAuthType | undefined {
  return MCP_CATALOG[serverId]?.auth_type
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
    category: entry.category,
    env_required: entry.env_required ?? [],
    headers_required: entry.headers_required ?? [],
    notes: entry.notes,
    docs_url: entry.docs_url,
    vendor: entry.vendor,
    maintained: entry.maintained,
    auth_type: entry.auth_type,
  }))
}
