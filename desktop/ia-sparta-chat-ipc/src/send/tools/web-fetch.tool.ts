import { executeWebFetch } from '../../../../ia-sparta-core/src/services/tools/web-fetch'
import { sendToRenderer } from '../../shared'
import { registerTool } from '../tool-registry'

registerTool({
  id: 'web_fetch', description: 'Obtiene y extrae el contenido de una página web.',
  inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
  risk: 'low', sideEffects: ['network'], permission: 'network_url', idempotent: true, supportsCancellation: false,
  execute: async (ctx) => {
    const url = typeof ctx.toolInput.url === 'string' ? ctx.toolInput.url.trim() : ''
    sendToRenderer({ sessionId: ctx.sessionId, messageId: ctx.messageId, type: 'thinking:status', text: url ? `Obteniendo ${url}...` : 'Obteniendo página web...' })
    sendToRenderer({ sessionId: ctx.sessionId, messageId: ctx.messageId, type: 'search:progress', stage: 'searching', query: url, tool_call_id: ctx.toolCallId })
    const output = await executeWebFetch(url)
    sendToRenderer({ sessionId: ctx.sessionId, messageId: ctx.messageId, type: 'search:progress', stage: 'done', tool_call_id: ctx.toolCallId })
    return output
  },
})
