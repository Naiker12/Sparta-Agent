/**
 * Sparta Agent — Serverless OAuth Broker Minimal Implementation
 * Compatible con Cloudflare Workers, Vercel Edge Functions, Netlify Functions o Node HTTP.
 *
 * Mantiene client_secret seguro en variables de entorno para clientes confidenciales (Notion, Slack, Figma).
 */

interface ExchangePayload {
  code: string
  redirect_uri: string
  server_id: 'notion' | 'slack' | 'figma' | string
}

interface Env {
  NOTION_CLIENT_ID?: string
  NOTION_CLIENT_SECRET?: string
  SLACK_CLIENT_ID?: string
  SLACK_CLIENT_SECRET?: string
  FIGMA_CLIENT_ID?: string
  FIGMA_CLIENT_SECRET?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    const url = new URL(request.url)
    if (request.method !== 'POST' || !url.pathname.includes('/exchange')) {
      return new Response(JSON.stringify({ error: 'Endpoint no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const body = (await request.json()) as ExchangePayload
      const { code, redirect_uri, server_id } = body

      if (!code || !redirect_uri || !server_id) {
        return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos: code, redirect_uri, server_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (server_id === 'notion') {
        const clientId = env.NOTION_CLIENT_ID
        const clientSecret = env.NOTION_CLIENT_SECRET
        if (!clientId || !clientSecret) {
          return new Response(JSON.stringify({ error: 'Credenciales del broker para Notion no configuradas' }), { status: 500 })
        }

        const authHeader = 'Basic ' + btoa(`${clientId}:${clientSecret}`)
        const resp = await fetch('https://api.notion.com/v1/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri,
          }),
        })

        const data = await resp.json() as Record<string, unknown>
        if (!resp.ok) {
          return new Response(JSON.stringify({ error: data.error ?? 'Falló intercambio en Notion' }), { status: resp.status })
        }

        return new Response(JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          account_label: (data.owner as Record<string, unknown>)?.user
            ? ((data.owner as Record<string, unknown>).user as Record<string, unknown>).name
            : 'Workspace de Notion',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }

      if (server_id === 'slack') {
        const clientId = env.SLACK_CLIENT_ID
        const clientSecret = env.SLACK_CLIENT_SECRET
        if (!clientId || !clientSecret) {
          return new Response(JSON.stringify({ error: 'Credenciales del broker para Slack no configuradas' }), { status: 500 })
        }

        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri,
        })

        const resp = await fetch('https://slack.com/api/oauth.v2.access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params,
        })

        const data = await resp.json() as Record<string, unknown>
        if (!resp.ok || !data.ok) {
          return new Response(JSON.stringify({ error: data.error ?? 'Falló intercambio en Slack' }), { status: 400 })
        }

        const authedUser = data.authed_user as Record<string, unknown> | undefined
        return new Response(JSON.stringify({
          access_token: authedUser?.access_token ?? data.access_token,
          refresh_token: data.refresh_token,
          account_label: (data.team as Record<string, unknown>)?.name ?? 'Workspace Slack',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }

      if (server_id === 'figma') {
        const clientId = env.FIGMA_CLIENT_ID
        const clientSecret = env.FIGMA_CLIENT_SECRET
        if (!clientId || !clientSecret) {
          return new Response(JSON.stringify({ error: 'Credenciales del broker para Figma no configuradas' }), { status: 500 })
        }

        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri,
        })

        const resp = await fetch('https://www.figma.com/api/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params,
        })

        const data = await resp.json() as Record<string, unknown>
        if (!resp.ok) {
          return new Response(JSON.stringify({ error: data.error ?? 'Falló intercambio en Figma' }), { status: resp.status })
        }

        return new Response(JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          account_label: 'Cuenta de Figma',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }

      return new Response(JSON.stringify({ error: `Proveedor '${server_id}' no soportado por el broker` }), { status: 400 })
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
    }
  },
}
