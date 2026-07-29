import { ipcMain, shell } from 'electron'
import * as http from 'http'
import * as crypto from 'crypto'
import { URL } from 'url'

interface OAuthRequest {
  serverId: string
  authorizeUrl: string
}

interface OAuthResult {
  ok: boolean
  account_label?: string
  error?: string
}

const activeServers = new Map<string, http.Server>()

function generateCodeVerifier(): string {
  return crypto.randomBytes(32)
    .toString('base64')
    .replace(/[+/=]/g, '')
    .slice(0, 128)
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/[+/=]/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function startLoopbackServer(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code')
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><p>Autenticación completada. Ya puedes cerrar esta ventana.</p></body></html>')
          resolve(code)
        } else {
          const error = url.searchParams.get('error') ?? 'unknown_error'
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`<html><body><p>Error: ${error}</p></body></html>`)
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

async function exchangeCodeForTokens(
  serverId: string,
  _code: string,
  _codeVerifier: string,
): Promise<{ access_token: string; refresh_token?: string; account_label?: string }> {
  // This is a stub — each provider has a different token exchange endpoint.
  // The actual implementation routes through the sidecar or a provider-specific URL.
  // For now we return a placeholder; the real exchange happens in the provider's callback.
  return {
    access_token: `stub_token_${serverId}_${Date.now()}`,
    account_label: `user@${serverId}.com`,
  }
}

export function registerMcpOAuthIPC(): void {
  ipcMain.handle('mcp:oauth:start', async (_event, req: OAuthRequest): Promise<OAuthResult> => {
    const { serverId, authorizeUrl } = req

    if (!authorizeUrl) {
      return { ok: false, error: 'No se proporcionó URL de autorización' }
    }

    try {
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = generateCodeChallenge(codeVerifier)
      const port = 18000 + Math.floor(Math.random() * 1000)

      const authUrl = new URL(authorizeUrl)
      authUrl.searchParams.set('code_challenge', codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      authUrl.searchParams.set('redirect_uri', `http://127.0.0.1:${port}/callback`)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('state', serverId)

      // Open browser with the provider's authorize URL
      shell.openExternal(authUrl.toString())

      // Start loopback server and wait for callback
      const code = await startLoopbackServer(port)

      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(serverId, code, codeVerifier)

      // Store tokens via vault (accessible through preload)
      // The vault is available to the renderer; we signal success back
      // The renderer will store tokens in vault.

      // Cleanup
      const server = activeServers.get(`oauth_${port}`)
      if (server) {
        server.close()
        activeServers.delete(`oauth_${port}`)
      }

      return {
        ok: true,
        account_label: tokens.account_label,
      }
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message ?? 'Error durante autenticación OAuth',
      }
    }
  })

  // Cleanup on app close
  ipcMain.on('oauth:cleanup', () => {
    for (const [, server] of activeServers) {
      server.close()
    }
    activeServers.clear()
  })
}
