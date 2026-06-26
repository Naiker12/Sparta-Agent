import { ipcMain, BrowserWindow } from 'electron'
import type { ProviderVendor } from '../../src/interfaces/provider.interface'

interface ChatRequest {
  sessionId: string
  messageId: string
  model: string
  messages: { role: string; content: string }[]
  providerKey?: string
  apiUrl?: string
  isLocal?: boolean
  system?: string
  vendor?: ProviderVendor
  providerId?: string
}

const activeStreams = new Map<string, AbortController>()

const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: 'Solicitud inválida. Revisa los parámetros.',
  401: 'API key inválida o expirada.',
  403: 'Acceso denegado.',
  404: 'Endpoint no encontrado.',
  429: 'Rate limit del proveedor.',
  500: 'Error interno del servidor.',
  502: 'Error de gateway.',
  503: 'Servicio no disponible.',
  529: 'Proveedor sobrecargado.',
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 529
}

const VENDOR_BASE_URLS: Partial<Record<ProviderVendor, string>> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  groq: 'https://api.groq.com/openai',
  mistral: 'https://api.mistral.ai',
  deepseek: 'https://api.deepseek.com',
  together: 'https://api.together.xyz',
  fireworks: 'https://api.fireworks.ai/inference',
  openrouter: 'https://openrouter.ai/api',
  cohere: 'https://api.cohere.ai',
  perplexity: 'https://api.perplexity.ai',
  xai: 'https://api.x.ai',
}

function getBaseUrl(vendor?: ProviderVendor, apiUrl?: string): string {
  if (apiUrl) return apiUrl.replace(/\/+$/, '')
  if (vendor && VENDOR_BASE_URLS[vendor]) return VENDOR_BASE_URLS[vendor]!
  return 'https://api.openai.com'
}

function getEndpoint(vendor?: ProviderVendor, apiUrl?: string, isLocal?: boolean): string {
  const base = getBaseUrl(vendor, apiUrl)
  if (vendor === 'anthropic') return `${base}/v1/messages`
  if (isLocal) {
    if (base.includes('/api/chat')) return base
    if (base.includes('/v1')) return `${base}/chat/completions`
    return `${base}/v1/chat/completions`
  }
  return `${base}/v1/chat/completions`
}

function getHeaders(
  providerKey: string,
  vendor?: ProviderVendor,
  isLocal?: boolean,
): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (isLocal) return headers
  if (vendor === 'anthropic') {
    headers['x-api-key'] = providerKey
    headers['anthropic-version'] = '2023-06-01'
  } else if (vendor === 'google') {
    // Google uses query param key
  } else {
    headers['Authorization'] = `Bearer ${providerKey}`
  }
  return headers
}

function buildBody(req: ChatRequest): string {
  const { vendor, model, messages, system, isLocal, apiUrl } = req
  if (vendor === 'anthropic') {
    return JSON.stringify({
      model,
      messages,
      system,
      max_tokens: 4096,
      stream: true,
    })
  }
  if (isLocal && apiUrl?.includes('/api/chat')) {
    return JSON.stringify({ model, messages, stream: true })
  }
  return JSON.stringify({
    model,
    messages: system
      ? [{ role: 'system', content: system }, ...messages]
      : messages,
    stream: true,
    max_tokens: 4096,
  })
}

export function registerChatIPC() {
  ipcMain.handle('chat:send', async (_event, req: ChatRequest) => {
    const { providerKey, sessionId, messageId, isLocal, vendor } = req
    if (!providerKey && !isLocal) return { ok: false, error: 'No provider configured' }

    const abortController = new AbortController()
    activeStreams.set(sessionId, abortController)

    const win = BrowserWindow.getFocusedWindow()
    let chunkSeq = 0
    let hasEmittedContent = false
    const requestStartedAt = Date.now()
    function sendChunk(chunk: Record<string, unknown>) {
      if (chunk.type === 'content_token' || chunk.type === 'thinking_token') {
        hasEmittedContent = true
      }
      const augmented = { sessionId, messageId, chunkSeq: ++chunkSeq, ...getMetadata(), ...chunk }
      console.debug(`[chat:send] chunk #${chunkSeq} session=${sessionId.slice(0,8)} type=${chunk.type} delta=${(chunk.delta as string ?? '').slice(0,40)}`)
      win?.webContents.send('sparta:event', augmented)
    }

    let httpStatus = 0
    const getMetadata = () => ({ vendor, httpStatus: httpStatus || 200, latency: Date.now() - requestStartedAt, providerId: req.providerId })
    try {
      const endpoint = getEndpoint(vendor, req.apiUrl, isLocal)
      const headers = getHeaders(providerKey ?? '', vendor, isLocal)
      const body = buildBody(req)

      if (providerKey) {
        console.debug(`[chat:send] ${vendor ?? 'unknown'} POST ${endpoint} key=${providerKey.slice(0, 6)}...${providerKey.length}`)
      }

      let response: Response | null = null
      const maxRetries = 1
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0 && hasEmittedContent) {
          console.warn('[chat:send] Retry skipped — partial content already emitted, aborting.')
          break
        }
        response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body,
          signal: abortController.signal,
        })
        httpStatus = response.status
        if (!isRetryable(response.status) || attempt >= maxRetries) break
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000)
        await new Promise((r) => setTimeout(r, delay))
      }

      if (!response!.ok) {
        const msg = HTTP_STATUS_MESSAGES[response!.status] ?? `HTTP ${response!.status}`
        sendChunk({ type: 'error', error: msg, ...getMetadata() })
        return { ok: false, error: msg }
      }

      const reader = response!.body?.getReader()
      if (!reader) {
        sendChunk({ type: 'error', error: 'No response body' })
        return { ok: false, error: 'No response body' }
      }

      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let doneSent = false

      while (true) {
        const { done, value } = await reader.read()
        if (value && value.length > 0) {
          buffer += decoder.decode(value, { stream: true })
        }
        if (done) break

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          const json = trimmed.slice(5).trim()
          if (json === '[DONE]') {
            if (!doneSent) { sendChunk({ type: 'done' }); doneSent = true }
            continue
          }
          try {
            const parsed = JSON.parse(json)
            if (vendor === 'anthropic') {
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                sendChunk({ type: 'content_token', delta: parsed.delta.text })
              }
            } else {
              const choice = parsed.choices?.[0]
              if (choice?.delta?.content) {
                sendChunk({ type: 'content_token', delta: choice.delta.content })
              }
              if (choice?.delta?.reasoning_content) {
                sendChunk({ type: 'thinking_token', delta: choice.delta.reasoning_content })
              }
              if (choice?.finish_reason === 'stop' || choice?.finish_reason === 'end_turn') {
                if (!doneSent) { sendChunk({ type: 'done' }); doneSent = true }
              }
            }
          } catch { /* skip parse errors */ }
        }
      }

      if (!doneSent) { sendChunk({ type: 'done' }); doneSent = true }
      return { ok: true }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        sendChunk({ type: 'done' })
        return { ok: true, aborted: true }
      }
      sendChunk({ type: 'error', error: (err as Error).message })
      return { ok: false, error: (err as Error).message }
    } finally {
      activeStreams.delete(sessionId)
    }
  })

  ipcMain.handle('chat:abort', (_event, sessionId: string) => {
    const controller = activeStreams.get(sessionId)
    if (controller) {
      controller.abort()
      activeStreams.delete(sessionId)
    }
  })
}
