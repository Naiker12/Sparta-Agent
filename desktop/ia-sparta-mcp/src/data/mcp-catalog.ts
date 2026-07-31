// Auto-generated from sparta_mcp_catalog.json — DO NOT EDIT BY HAND.
// Run `npx tsx scripts/generate-mcp-catalog.ts` to regenerate.

import type { MCPAuthType } from 'ia-sparta-core'

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
  "github": {
    name: "GitHub",
    description: "Acceso a repositorios, issues, pull requests y mas de GitHub (HTTP remoto oficial)",
    type: "http",
    url: "https://api.github.com/mcp",
    env_required: ["GITHUB_TOKEN"],
    docs_url: "https://github.com/github/github-mcp-server",
    vendor: "github",
    maintained: true,
    auth_type: "api_key",
    category: "DevTools",
  },

  "git": {
    name: "Git",
    description: "Operaciones git estructuradas: diff, log, status, blame, branches",
    type: "stdio",
    command: "uvx",
    args: ["mcp-server-git","--repository","${REPO_DIR}"],
    env_required: [],
    notes: "Requiere la ruta al repositorio git.",
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
    vendor: "git",
    maintained: true,
    auth_type: "none",
    category: "DevTools",
  },

  "filesystem": {
    name: "Filesystem",
    description: "Acceso controlado al sistema de archivos local (requiere ruta permitida)",
    type: "stdio",
    command: "npx",
    args: ["-y","@modelcontextprotocol/server-filesystem","${DIR}"],
    env_required: [],
    notes: "Requiere especificar un directorio permitido (${DIR}).",
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    vendor: "filesystem",
    maintained: true,
    auth_type: "none",
    category: "Storage",
  },

  "google-drive": {
    name: "Google Drive",
    description: "Acceso a archivos y documentos en Google Drive",
    type: "http",
    url: "https://workspace-mcp.googleapis.com/mcp",
    env_required: [],
    docs_url: "https://developers.google.com/workspace/guides/configure-mcp-servers",
    vendor: "google-drive",
    maintained: true,
    auth_type: "oauth2",
    category: "Storage",
  },

  "onedrive": {
    name: "OneDrive / SharePoint",
    description: "Acceso a archivos en OneDrive y SharePoint Online",
    type: "stdio",
    command: "npx",
    args: ["-y","ms-365-mcp-server"],
    env_required: [],
    docs_url: "https://github.com/Softeria/ms-365-mcp-server",
    vendor: "microsoft",
    maintained: true,
    auth_type: "oauth2",
    category: "Storage",
  },

  "supabase": {
    name: "Supabase",
    description: "Consulta y administracion de bases de datos Supabase (PostgreSQL + API)",
    type: "http",
    url: "https://mcp.supabase.com/mcp",
    env_required: [],
    docs_url: "https://supabase.com/docs/guides/ai-tools/mcp",
    vendor: "supabase",
    maintained: true,
    auth_type: "oauth2",
    category: "Database",
  },

  "dbhub": {
    name: "DBHub (Postgres/MySQL/SQLite)",
    description: "Un solo servidor para PostgreSQL, MySQL y SQLite (reemplaza los paquetes archivados)",
    type: "stdio",
    command: "npx",
    args: ["-y","@bytebase/dbhub","--dsn","${DATABASE_URL}"],
    env_required: ["DATABASE_URL"],
    notes: "Usa una connection string. Soporta PostgreSQL, MySQL y SQLite.",
    docs_url: "https://github.com/bytebase/dbhub",
    vendor: "database",
    maintained: true,
    auth_type: "api_key",
    category: "Database",
  },

  "mongodb": {
    name: "MongoDB",
    description: "Consulta y analisis de bases de datos MongoDB",
    type: "stdio",
    command: "npx",
    args: ["-y","@mongodb-js/mongodb-mcp-server","--connection-string","${MONGODB_URI}"],
    env_required: ["MONGODB_URI"],
    notes: "Servidor oficial de MongoDB.",
    docs_url: "https://github.com/mongodb-js/mongodb-mcp-server",
    vendor: "mongodb",
    maintained: true,
    auth_type: "api_key",
    category: "Database",
  },

  "notion": {
    name: "Notion",
    description: "Lectura y busqueda en paginas y bases de datos de Notion",
    type: "http",
    url: "https://mcp.notion.com/mcp",
    headers_required: ["Authorization"],
    docs_url: "https://developers.notion.com/docs/authorization",
    vendor: "notion",
    maintained: true,
    auth_type: "oauth2",
    category: "Productivity",
  },

  "gmail": {
    name: "Gmail",
    description: "Lectura y envio de correos electronicos en Gmail",
    type: "http",
    url: "https://gmail-mcp.googleapis.com/mcp",
    env_required: [],
    docs_url: "https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server",
    vendor: "gmail",
    maintained: true,
    auth_type: "oauth2",
    category: "Productivity",
  },

  "google-calendar": {
    name: "Google Calendar",
    description: "Lectura y gestion de eventos en Google Calendar",
    type: "http",
    url: "https://calendar-mcp.googleapis.com/mcp",
    env_required: [],
    docs_url: "https://developers.google.com/workspace/guides/configure-mcp-servers",
    vendor: "google-calendar",
    maintained: true,
    auth_type: "oauth2",
    category: "Productivity",
  },

  "slack": {
    name: "Slack",
    description: "Lectura y envio de mensajes en Slack",
    type: "http",
    url: "https://mcp.slack.com/mcp",
    env_required: [],
    docs_url: "https://api.slack.com/mcp",
    vendor: "slack",
    maintained: true,
    auth_type: "oauth2",
    category: "Comunicacion",
  },

  "figma": {
    name: "Figma",
    description: "Acceso al contexto de diseno de Figma para agentes",
    type: "http",
    url: "https://mcp.figma.com/mcp",
    env_required: [],
    docs_url: "https://www.figma.com/developers/mcp",
    vendor: "figma",
    maintained: true,
    auth_type: "oauth2",
    category: "Diseno",
  },

  "stripe": {
    name: "Stripe",
    description: "Consulta de pagos, clientes y suscripciones en Stripe",
    type: "http",
    url: "https://mcp.stripe.com/mcp",
    env_required: ["STRIPE_SECRET_KEY"],
    notes: "Usa una clave restringida (nunca la clave live completa).",
    docs_url: "https://docs.stripe.com/mcp",
    vendor: "stripe",
    maintained: true,
    auth_type: "api_key",
    category: "Pagos",
  },

  "sentry": {
    name: "Sentry",
    description: "Consulta de issues, errores y rendimiento en Sentry",
    type: "http",
    url: "https://mcp.sentry.dev/mcp",
    env_required: ["SENTRY_AUTH_TOKEN"],
    headers_required: ["Authorization"],
    notes: "Requiere un token de Integracion Interna de Sentry (SENTRY_AUTH_TOKEN).",
    docs_url: "https://docs.sentry.io/mcp/",
    vendor: "sentry",
    maintained: true,
    auth_type: "api_key",
    category: "Monitoreo",
  },

  "fetch": {
    name: "Fetch",
    description: "Obtencion de contenido web con conversion a markdown (util para RAG)",
    type: "stdio",
    command: "uvx",
    args: ["mcp-server-fetch"],
    env_required: [],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
    vendor: "fetch",
    maintained: true,
    auth_type: "none",
    category: "Web",
  },

  "playwright": {
    name: "Playwright",
    description: "Navegacion web automatizada, capturas y extraccion de contenido (reemplaza Puppeteer)",
    type: "stdio",
    command: "npx",
    args: ["-y","@playwright/mcp"],
    env_required: [],
    notes: "Reemplaza el paquete archivado de Puppeteer.",
    docs_url: "https://github.com/microsoft/playwright-mcp",
    vendor: "playwright",
    maintained: true,
    auth_type: "none",
    category: "Web",
  },

  "chrome-devtools": {
    name: "Chrome DevTools MCP",
    description: "Inspeccion real de una pestana de Chrome: DOM, consola, red, rendimiento",
    type: "stdio",
    command: "npx",
    args: ["-y","chrome-devtools-mcp"],
    env_required: [],
    notes: "Requiere Chrome abierto con --remote-debugging-port.",
    docs_url: "https://github.com/ChromeDevTools/chrome-devtools-mcp",
    vendor: "chrome",
    maintained: true,
    auth_type: "none",
    category: "Web",
  },

  "memory": {
    name: "Memory",
    description: "Knowledge graph en memoria para recall de contexto entre sesiones",
    type: "stdio",
    command: "uvx",
    args: ["mcp-server-memory"],
    env_required: [],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
    vendor: "memory",
    maintained: true,
    auth_type: "none",
    category: "Knowledge",
  },

  "time": {
    name: "Time",
    description: "Zona horaria y hora actual del sistema",
    type: "stdio",
    command: "uvx",
    args: ["mcp-server-time"],
    env_required: [],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/time",
    vendor: "time",
    maintained: true,
    auth_type: "none",
    category: "Utility",
  },
}

export function getVendorForServer(serverId: string): string | undefined {
  return MCP_CATALOG[serverId]?.vendor
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
