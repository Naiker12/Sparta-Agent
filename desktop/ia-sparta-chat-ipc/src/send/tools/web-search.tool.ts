import { executeWebSearch } from '../../../../ia-sparta-core/src/services/tools/web-search'
import { sendToRenderer } from '../../shared'
import { registerTool } from '../tool-registry'

registerTool({
  id: 'web_search', description: 'Busca información actual en la web.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      count: { type: 'number', minimum: 1, maximum: 10 },
      freshness: { type: 'string', enum: ['day', 'week', 'month', 'any'] },
    },
    required: ['query'],
  },
  risk: 'low', sideEffects: ['network'], permission: 'network_url', idempotent: true, supportsCancellation: false,
  execute: async (ctx) => {
    const query = typeof ctx.toolInput.query === 'string' ? ctx.toolInput.query : JSON.stringify(ctx.toolInput)
    sendToRenderer({ sessionId: ctx.sessionId, messageId: ctx.messageId, type: 'search:progress', stage: 'searching', query, tool_call_id: ctx.toolCallId })
    sendToRenderer({ sessionId: ctx.sessionId, messageId: ctx.messageId, type: 'thinking:status', text: `Buscando en la web: "${query}"...` })
    const count = typeof ctx.toolInput.count === 'number' ? ctx.toolInput.count : 5
    const freshness = ctx.toolInput.freshness === 'day' || ctx.toolInput.freshness === 'week' || ctx.toolInput.freshness === 'month'
      ? ctx.toolInput.freshness
      : 'any'
    const output = await executeWebSearch(query, count, freshness)
    sendToRenderer({ sessionId: ctx.sessionId, messageId: ctx.messageId, type: 'search:progress', stage: 'done', tool_call_id: ctx.toolCallId })
    return output
  },
})
