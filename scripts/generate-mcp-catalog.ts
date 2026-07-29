/**
 * Generates desktop/ia-sparta-mcp/src/data/mcp-catalog.ts from sparta_mcp_catalog.json.
 *
 * Usage:
 *   npx tsx scripts/generate-mcp-catalog.ts
 *
 * This ensures the TypeScript catalog stays in sync with the JSON source of truth.
 * Run this after editing sparta_mcp_catalog.json.
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '..')
const JSON_PATH = path.join(ROOT, 'sparta_mcp_catalog.json')
const OUTPUT_PATH = path.join(ROOT, 'desktop/ia-sparta-mcp/src/data/mcp-catalog.ts')

// Read JSON catalog
const raw = fs.readFileSync(JSON_PATH, 'utf-8')
const json = JSON.parse(raw)
const servers: Record<string, unknown> = json.servers ?? {}

// Build TypeScript output
const entries: string[] = []

for (const [id, entry] of Object.entries(servers)) {
  const e = entry as Record<string, unknown>
  const name = JSON.stringify(e.name ?? id)
  const description = JSON.stringify(e.description ?? '')
  const type = JSON.stringify(e.type ?? 'stdio')
  const command = e.command ? JSON.stringify(e.command) : undefined
  const args = e.args ? JSON.stringify(e.args) : undefined
  const url = e.url ? JSON.stringify(e.url) : undefined
  const env_required = e.env_required ? JSON.stringify(e.env_required) : undefined
  const headers_required = e.headers_required ? JSON.stringify(e.headers_required) : undefined
  const notes = e.notes ? JSON.stringify(e.notes) : undefined
  const docs_url = e.docs_url ? JSON.stringify(e.docs_url) : undefined
  const vendor = e.vendor ? JSON.stringify(e.vendor) : undefined
  const maintained = e.maintained !== undefined ? String(e.maintained) : undefined
  const auth_type = JSON.stringify(e.auth_type ?? 'none')
  const category = JSON.stringify(e.category ?? 'Other')

  const fields: string[] = [
    `name: ${name}`,
    `description: ${description}`,
    `type: ${type}`,
  ]

  if (command) fields.push(`command: ${command}`)
  if (args) fields.push(`args: ${args}`)
  if (url) fields.push(`url: ${url}`)
  if (env_required) fields.push(`env_required: ${env_required}`)
  if (headers_required) fields.push(`headers_required: ${headers_required}`)
  if (notes) fields.push(`notes: ${notes}`)
  if (docs_url) fields.push(`docs_url: ${docs_url}`)
  if (vendor) fields.push(`vendor: ${vendor}`)
  if (maintained) fields.push(`maintained: ${maintained}`)
  fields.push(`auth_type: ${auth_type}`)
  fields.push(`category: ${category}`)

  entries.push(`  ${JSON.stringify(id)}: {\n${fields.map(f => `    ${f}`).join(',\n')},\n  }`)
}

const output = `// Auto-generated from sparta_mcp_catalog.json — DO NOT EDIT BY HAND.
// Run \`npx tsx scripts/generate-mcp-catalog.ts\` to regenerate.

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
${entries.join(',\n\n')},
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
      ? \`\${entry.command} \${(entry.args ?? []).join(' ')}\`
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
`

fs.writeFileSync(OUTPUT_PATH, output, 'utf-8')
console.log(`✓ Generated ${OUTPUT_PATH}`)
