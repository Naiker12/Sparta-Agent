import { ipcMain, shell } from 'electron'
import * as http from 'http'
import * as crypto from 'crypto'
import { URL } from 'url'
import { getOAuthProviderConfig } from './mcp/oauth/mcp-oauth-providers.catalog'

interface OAuthRequest {
  serverId: string
  authorizeUrl?: string
  tokenEndpoint?: string
  clientId?: string
  clientSecret?: string
  scopes?: string[]
}

interface OAuthResult {
  ok: boolean
  account_label?: string
  access_token?: string
  refresh_token?: string
  error?: string
}

interface DiscoverResult {
  ok: boolean
  authorization_endpoint?: string
  token_endpoint?: string
  registration_endpoint?: string
  client_id?: string
  error?: string
}

const activeServers = new Map<string, http.Server>()
const recentLaunches = new Map<string, number>()

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(32))
}

function generateCodeChallenge(verifier: string): string {
  return base64UrlEncode(crypto.createHash('sha256').update(verifier).digest())
}

function startLoopbackServer(port: number, pathName = '/callback'): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
      if (url.pathname === pathName || url.pathname === '/' || url.pathname === '/callback') {
        const code = url.searchParams.get('code')
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<html><body style="font-family:sans-serif;text-align:center;padding:40px;"><h2>Autenticación completada</h2><p>Ya puedes cerrar esta ventana y regresar a Sparta Agent.</p></body></html>')
          resolve(code)
        } else {
          const error = url.searchParams.get('error') ?? 'unknown_error'
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;"><h2>Error de Autenticación</h2><p>${error}</p></body></html>`)
          reject(new Error(error))
        }
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    server.listen(port, '127.0.0.1', () => {
      activeServers.set(`oauth_${port}`, server)
    })

    server.on('error', reject)
  })
}

async function discoverOAuthMetadata(serverUrl: string): Promise<{
  authorization_endpoint?: string
  token_endpoint?: string
  registration_endpoint?: string
  error?: string
}> {
  try {
    const protectedUrl = serverUrl.replace(/\/+$/, '') + '/.well-known/oauth-protected-resource'
    const protectedResp = await fetch(protectedUrl, { signal: AbortSignal.timeout(10_000) })
    if (!protectedResp.ok) {
      return { error: `/.well-known/oauth-protected-resource responded ${protectedResp.status}` }
    }
    const protectedJson = await protectedResp.json() as { authorization_server?: string }
    const asUrl = protectedJson.authorization_server
    if (!asUrl) {
      return { error: 'No authorization_server in oauth-protected-resource response' }
    }

    const asMetaUrl = asUrl.replace(/\/+$/, '') + '/.well-known/oauth-authorization-server'
    const asResp = await fetch(asMetaUrl, { signal: AbortSignal.timeout(10_000) })
    if (!asResp.ok) {
      return { error: `/.well-known/oauth-authorization-server responded ${asResp.status}` }
    }
    const asJson = await asResp.json() as {
      authorization_endpoint?: string
      token_endpoint?: string
      registration_endpoint?: string
    }
    return {
      authorization_endpoint: asJson.authorization_endpoint,
      token_endpoint: asJson.token_endpoint,
      registration_endpoint: asJson.registration_endpoint,
    }
  } catch (err) {
    return { error: `OAuth discovery failed: ${(err as Error).message}` }
  }
}

async function dynamicClientRegistration(
  registrationEndpoint: string,
  redirectUri: string,
): Promise<{ client_id?: string; error?: string }> {
  try {
    const resp = await fetch(registrationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Sparta Agent',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code'],
        token_endpoint_auth_method: 'none',
        response_types: ['code'],
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!resp.ok) {
      return { error: `Dynamic Client Registration responded ${resp.status}` }
    }
    const data = await resp.json() as { client_id?: string }
    return { client_id: data.client_id }
  } catch (err) {
    return { error: `DCR failed: ${(err as Error).message}` }
  }
}

async function exchangeCodeForTokens(
  tokenEndpoint: string,
  code: string,
  codeVerifier: string | undefined,
  clientId: string,
  redirectUri: string,
  clientSecret?: string,
): Promise<{ access_token?: string; refresh_token?: string; account_label?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
    })

    if (codeVerifier) {
      params.set('code_verifier', codeVerifier)
    }

    if (clientSecret) {
      params.set('client_secret', clientSecret)
    }

    const resp = await fetch(tokenEndpoint, {
      method: 'POST',
      headers,
      body: params,
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) {
      const body = await resp.text()
      return { error: `Token exchange failed (${resp.status}): ${body}` }
    }
    const data = await resp.json() as {
      access_token?: string
      refresh_token?: string
      id_token?: string
      authed_user?: { id?: string }
    }
    if (!data.access_token) {
      return { error: 'No access_token in token response' }
    }
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      account_label: data.id_token
        ? extractEmailFromIdToken(data.id_token)
        : data.authed_user?.id,
    }
  } catch (err) {
    return { error: `Token exchange error: ${(err as Error).message}` }
  }
}

async function exchangeCodeViaBroker(
  brokerEndpoint: string,
  code: string,
  redirectUri: string,
  serverId: string,
): Promise<{ access_token?: string; refresh_token?: string; account_label?: string; error?: string }> {
  try {
    const resp = await fetch(brokerEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri, server_id: serverId }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) {
      const body = await resp.text()
      return { error: `Broker exchange failed (${resp.status}): ${body}` }
    }
    const data = await resp.json() as { access_token?: string; refresh_token?: string; account_label?: string }
    return data
  } catch (err) {
    return { error: `Broker network error: ${(err as Error).message}` }
  }
}

function extractEmailFromIdToken(idToken: string): string | undefined {
  try {
    const payload = idToken.split('.')[1]
    if (!payload) return undefined
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString())
    return decoded.email ?? decoded.sub
  } catch {
    return undefined
  }
}

export function registerMcpOAuthIPC(): void {
  ipcMain.handle('mcp:oauth:discover', async (_event, req: { serverUrl: string }): Promise<DiscoverResult> => {
    if (!req.serverUrl) {
      return { ok: false, error: 'No server URL provided' }
    }
    const meta = await discoverOAuthMetadata(req.serverUrl)
    if (meta.error) {
      return { ok: false, error: meta.error }
    }
    let clientId: string | undefined
    if (meta.registration_endpoint) {
      const redirectUri = `http://127.0.0.1:${18000 + Math.floor(Math.random() * 1000)}/callback`
      const dcr = await dynamicClientRegistration(meta.registration_endpoint, redirectUri)
      if (dcr.client_id) {
        clientId = dcr.client_id
      }
    }
    return {
      ok: true,
      authorization_endpoint: meta.authorization_endpoint,
      token_endpoint: meta.token_endpoint,
      registration_endpoint: meta.registration_endpoint,
      client_id: clientId,
    }
  })

  ipcMain.handle('mcp:oauth:start', async (_event, req: OAuthRequest): Promise<OAuthResult> => {
    const now = Date.now()
    const lastLaunch = recentLaunches.get(req.serverId) ?? 0
    if (now - lastLaunch < 2500) {
      return { ok: false, error: 'Proceso de autorización ya en curso en el navegador' }
    }
    recentLaunches.set(req.serverId, now)

    const providerConfig = getOAuthProviderConfig(req.serverId)
    const authorizeUrl = req.authorizeUrl || providerConfig?.authEndpoint
    const tokenEndpoint = req.tokenEndpoint || providerConfig?.tokenEndpoint
    const clientId = req.clientId || providerConfig?.clientId

    if (!authorizeUrl) {
      return { ok: false, error: `No se configuró URL de autorización para el proveedor ${req.serverId}` }
    }

    if (!clientId) {
      return { ok: false, error: `Falta configurar la clave de cliente (client_id) para ${req.serverId}. Revisa tu archivo .env.` }
    }

    try {
      const usesPKCE = providerConfig?.usesPKCE ?? true
      const requiresBroker = providerConfig?.requiresBroker ?? false
      const brokerEndpoint = providerConfig?.brokerEndpoint
      const redirectStrategy = providerConfig?.redirectStrategy ?? 'loopback'

      const codeVerifier = usesPKCE ? generateCodeVerifier() : undefined
      const codeChallenge = codeVerifier ? generateCodeChallenge(codeVerifier) : undefined
      const port = 18000 + Math.floor(Math.random() * 1000)

      const redirectUri = redirectStrategy === 'localhost'
        ? `http://localhost:${port}`
        : `http://127.0.0.1:${port}/callback`

      const authUrl = new URL(authorizeUrl)

      if (codeChallenge) {
        authUrl.searchParams.set('code_challenge', codeChallenge)
        authUrl.searchParams.set('code_challenge_method', 'S256')
      }

      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('state', req.serverId)

      if (clientId) {
        authUrl.searchParams.set('client_id', clientId)
      }

      const scopes = req.scopes ?? providerConfig?.scopes
      if (scopes && scopes.length > 0) {
        authUrl.searchParams.set('scope', scopes.join(' '))
      }

      if (providerConfig?.extraAuthParams) {
        for (const [key, val] of Object.entries(providerConfig.extraAuthParams)) {
          authUrl.searchParams.set(key, val)
        }
      }

      shell.openExternal(authUrl.toString())

      const code = await startLoopbackServer(port, redirectStrategy === 'localhost' ? '/' : '/callback')

      if (requiresBroker && brokerEndpoint) {
        const brokerResult = await exchangeCodeViaBroker(brokerEndpoint, code, redirectUri, req.serverId)
        if (brokerResult.error) {
          return { ok: false, error: brokerResult.error }
        }
        return {
          ok: true,
          access_token: brokerResult.access_token,
          refresh_token: brokerResult.refresh_token,
          account_label: brokerResult.account_label,
        }
      }

      if (tokenEndpoint && clientId) {
        const tokens = await exchangeCodeForTokens(
          tokenEndpoint,
          code,
          codeVerifier,
          clientId,
          redirectUri,
          req.clientSecret || providerConfig?.clientSecret,
        )
        if (tokens.error) {
          return { ok: false, error: tokens.error }
        }
        return {
          ok: true,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          account_label: tokens.account_label,
        }
      }

      return {
        ok: true,
        access_token: `placeholder_token_${req.serverId}_${Date.now()}`,
        account_label: `user@${req.serverId}.com`,
      }
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message ?? 'Error durante autenticación OAuth',
      }
    }
  })

  ipcMain.on('oauth:cleanup', () => {
    for (const [, server] of activeServers) {
      server.close()
    }
    activeServers.clear()
  })
}
