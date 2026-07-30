export type MCPServerType = 'stdio' | 'http'
export type MCPAuthType = 'none' | 'api_key' | 'oauth2'

export interface MCPToolFilter {
  /** Whitelist — if present, only these tools are exposed. Takes precedence over exclude. */
  include?: string[]
  /** Blacklist — ignored if include is set. */
  exclude?: string[]
}

export interface MCPOAuthSession {
  /** URL de autorización oficial del proveedor */
  provider_authorize_url: string
  connected_at?: string
  expires_at?: string
  /** Label para mostrar al usuario (ej. "tú@gmail.com"). No es un secreto. */
  account_label?: string
  /** Ref to access_token stored in encrypted vault */
  token_vault_ref?: string
  /** Ref to refresh_token stored in encrypted vault */
  refresh_token_vault_ref?: string
  /** client_id obtained via DCR or catalog */
  client_id?: string
  /** OAuth discovery — real endpoints resolved via well-known */
  authorization_endpoint?: string
  token_endpoint?: string
  registration_endpoint?: string
}

export interface MCPServerConfig {
  id: string
  name: string
  type: MCPServerType
  // ── stdio ──────────────────────────────
  command?: string
  args?: string[]
  /** Environment variables injected into the stdio process (plaintext — deprecated, use env_vault_refs) */
  env?: Record<string, string>
  /** Names of env vars stored in encrypted vault (preferred over env) */
  env_vault_refs?: string[]
  // ── http ───────────────────────────────
  url?: string
  /** HTTP headers (e.g. Authorization) (plaintext — deprecated, use headers_vault_refs) */
  headers?: Record<string, string>
  /** Names of headers stored in encrypted vault (preferred over headers) */
  headers_vault_refs?: string[]
  // ── shared ─────────────────────────────
  enabled: boolean
  /** Tool call timeout in seconds (default: 30) */
  timeout?: number
  /** Initial spawn + handshake timeout; npx servers default to 30 seconds. */
  connect_timeout?: number
  /** Optional tool include/exclude filter */
  tools?: MCPToolFilter
  /** Whether this server package is actively maintained (false = archived/deprecated) */
  maintained?: boolean
  auth_type: MCPAuthType
  oauth?: MCPOAuthSession
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: unknown
  serverId: string
}

export interface MCPServer {
  id: string
  name: string
  type: MCPServerType
  connected: boolean
  tools: MCPTool[]
  /** Most recent connection error, shown to the user instead of a silent 0/N badge. */
  lastError?: string
  config: MCPServerConfig
}
