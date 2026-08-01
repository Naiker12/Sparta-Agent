/**
 * tool-executor.ts
 * Dispatcher central de ejecución de herramientas (web_search, web_fetch, MCP, filesystem, run_command).
 */

import { executeWebSearch, executeWebFetch } from 'ia-sparta-core'
import { isMainProcessFileTool, executeMainProcessFileTool, runCommandForAgent } from 'ia-sparta-ipc-bridge'
import { getKey as vaultGetKey } from 'ia-sparta-vault'
import { McpProcessManager } from '../mcp/core/McpProcessManager'
import type { MCPServerConfig } from '../shared'
import { sendToRenderer } from '../shared'

export interface ToolCallContext {
  sessionId: string
  messageId: string
  toolCallId: string
  toolName: string
  toolInput: Record<string, unknown>
  mcpServers?: MCPServerConfig[]
  connectedFolder?: string
  workspaceRoot?: string
}

/** Base URLs de las APIs REST de Google */
const googleApiBaseUrls: Record<string, string> = {
  gmail: 'https://gmail.googleapis.com/gmail/v1/users/me',
  'google-drive': 'https://www.googleapis.com/drive/v3',
  'google-calendar': 'https://www.googleapis.com/calendar/v3',
  onedrive: 'https://graph.microsoft.com/v1.0/me/drive',
  notion: 'https://api.notion.com/v1',
}

/** Resuelve un campo buscando en múltiples alias */
function resolveField(input: Record<string, unknown>, ...aliases: string[]): string {
  for (const alias of aliases) {
    const val = input[alias]
    if (val && typeof val === 'string' && val.trim()) return val.trim()
  }
  return ''
}

/** Convierte texto Markdown plano en objetos rich_text con anotaciones de Notion */
function markdownToRichText(text: string): Array<{ type: 'text'; text: { content: string }; annotations?: { bold?: boolean; italic?: boolean; code?: boolean } }> {
  const parts: Array<{ type: 'text'; text: { content: string }; annotations?: { bold?: boolean; italic?: boolean; code?: boolean } }> = []
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|[^*`]+)/g
  const matches = text.match(regex) || [text]

  for (const m of matches) {
    if (m.startsWith('**') && m.endsWith('**')) {
      parts.push({ type: 'text', text: { content: m.slice(2, -2) }, annotations: { bold: true } })
    } else if (m.startsWith('*') && m.endsWith('*')) {
      parts.push({ type: 'text', text: { content: m.slice(1, -1) }, annotations: { italic: true } })
    } else if (m.startsWith('`') && m.endsWith('`')) {
      parts.push({ type: 'text', text: { content: m.slice(1, -1) }, annotations: { code: true } })
    } else {
      parts.push({ type: 'text', text: { content: m } })
    }
  }
  return parts.length > 0 ? parts : [{ type: 'text', text: { content: text } }]
}

/** Convierte una cadena de texto Markdown en bloques nativos de Notion */
function markdownToNotionBlocks(text: string): any[] {
  const lines = text.split('\n')
  const blocks: any[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: markdownToRichText(trimmed.slice(2)) },
      })
    } else if (trimmed.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: markdownToRichText(trimmed.slice(3)) },
      })
    } else if (trimmed.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: markdownToRichText(trimmed.slice(4)) },
      })
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: markdownToRichText(trimmed.slice(2)) },
      })
    } else if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s/, '')
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: markdownToRichText(content) },
      })
    } else if (trimmed.startsWith('> ')) {
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: { rich_text: markdownToRichText(trimmed.slice(2)) },
      })
    } else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: markdownToRichText(trimmed) },
      })
    }
  }

  return blocks.length > 0 ? blocks : [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
    },
  ]
}

/** Mapeo de herramientas MCP a endpoints REST de Google y Microsoft Graph */
function resolveGoogleApiCall(serverId: string, toolName: string, input: Record<string, unknown>): { url: string; method: string; body?: unknown; contentType?: string; rawBody?: string } | null {
  const baseUrl = googleApiBaseUrls[serverId]
  if (!baseUrl) return null

  if (serverId === 'gmail') {
    switch (toolName) {
      case 'list_messages': {
        const maxResults = input.max_results || input.maxResults || 10
        const q = input.query || input.q || ''
        return { url: `${baseUrl}/messages?maxResults=${maxResults}${q ? `&q=${encodeURIComponent(String(q))}` : ''}`, method: 'GET' }
      }
      case 'get_message':
        return { url: `${baseUrl}/messages/${input.messageId || input.id}?format=full`, method: 'GET' }
      case 'get_thread':
        return { url: `${baseUrl}/threads/${input.threadId || input.id}?format=full`, method: 'GET' }
      case 'search_threads': {
        const q = input.query || input.q || ''
        const max = input.max_results || input.maxResults || 10
        return { url: `${baseUrl}/threads?maxResults=${max}&q=${encodeURIComponent(String(q))}`, method: 'GET' }
      }
      case 'create_draft': {
        const to = resolveField(input, 'to', 'recipient', 'email', 'to_email', 'destinatario')
        const subject = resolveField(input, 'subject', 'asunto', 'titulo', 'title')
        const body = resolveField(input, 'body', 'message', 'content', 'texto', 'cuerpo', 'text')
        if (!to) return null
        return {
          url: `${baseUrl}/drafts`,
          method: 'POST',
          body: {
            message: {
              raw: Buffer.from(
                `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
              ).toString('base64url'),
            },
          },
        }
      }
      case 'send_message': {
        const to = resolveField(input, 'to', 'recipient', 'email', 'to_email', 'destinatario')
        const subject = resolveField(input, 'subject', 'asunto', 'titulo', 'title')
        const body = resolveField(input, 'body', 'message', 'content', 'texto', 'cuerpo', 'text')
        if (!to) return null
        return {
          url: `${baseUrl}/messages/send`,
          method: 'POST',
          body: {
            raw: Buffer.from(
              `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
            ).toString('base64url'),
          },
        }
      }
      default:
        return null
    }
  }

  if (serverId === 'google-drive') {
    switch (toolName) {
      case 'search_files': {
        const q = input.query || input.q || ''
        return { url: `${baseUrl}/files?q=${encodeURIComponent(String(q))}&fields=files(id,name,mimeType,modifiedTime,size)`, method: 'GET' }
      }
      case 'get_file_metadata':
        return { url: `${baseUrl}/files/${input.fileId || input.id}?fields=*`, method: 'GET' }
      case 'export_doc':
        return { url: `${baseUrl}/files/${input.fileId || input.id}/export?mimeType=${encodeURIComponent(String(input.mimeType || 'text/plain'))}`, method: 'GET' }
      default:
        return null
    }
  }

  if (serverId === 'onedrive') {
    switch (toolName) {
      case 'search_files': {
        const q = String(input.query || input.q || '').trim()
        if (!q) {
          return { url: `${baseUrl}/root/children`, method: 'GET' }
        }
        return { url: `${baseUrl}/root/search(q='${encodeURIComponent(q)}')`, method: 'GET' }
      }
      case 'list_files': {
        let folderId = String(input.folderId || input.id || '').trim()
        if (folderId.toLowerCase() === 'root' || folderId === '/') {
          folderId = ''
        }
        return { url: folderId ? `${baseUrl}/items/${folderId}/children` : `${baseUrl}/root/children`, method: 'GET' }
      }
      case 'download_file': {
        const fileId = String(input.fileId || input.id || input.filename || '').trim()
        const isPath = fileId.includes('/') || fileId.includes('.')
        const url = isPath
          ? `${baseUrl}/root:/${encodeURIComponent(fileId.replace(/^\//, ''))}:/content`
          : `${baseUrl}/items/${fileId}/content`
        return { url, method: 'GET' }
      }
      case 'get_file_metadata': {
        const fileId = String(input.fileId || input.id || input.filename || '').trim()
        const isPath = fileId.includes('/') || fileId.includes('.')
        const url = isPath
          ? `${baseUrl}/root:/${encodeURIComponent(fileId.replace(/^\//, ''))}`
          : `${baseUrl}/items/${fileId}`
        return { url, method: 'GET' }
      }
      case 'upload_file': {
        const rawName = String(input.filename || input.name || 'new_file.txt').trim()
        const filename = rawName.replace(/^\/+/, '')
        const folderId = String(input.folderId || input.parentFolderId || '').trim()

        let url = ''
        if (!folderId || folderId.toLowerCase() === 'root' || folderId === '/' || folderId === '\\') {
          url = `${baseUrl}/root:/${encodeURIComponent(filename)}:/content`
        } else if (folderId.includes('!') || folderId.length > 20) {
          url = `${baseUrl}/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(filename)}:/content`
        } else {
          const folderPath = folderId.replace(/^\/+/, '').replace(/\/+$/, '')
          url = `${baseUrl}/root:/${encodeURIComponent(folderPath)}/${encodeURIComponent(filename)}:/content`
        }

        const contentStr = String(input.content || input.contentText || '')
        return {
          url,
          method: 'PUT',
          contentType: 'text/plain; charset=utf-8',
          rawBody: contentStr,
        }
      }
      default:
        return null
    }
  }

  if (serverId === 'notion') {
    switch (toolName) {
      case 'search': {
        const query = String(input.query || input.q || '').trim()
        return { url: `${baseUrl}/search`, method: 'POST', body: query ? { query } : {} }
      }
      case 'get_page': {
        const pageId = String(input.page_id || input.id || '').trim()
        return { url: `${baseUrl}/pages/${pageId}`, method: 'GET' }
      }
      case 'get_database': {
        const dbId = String(input.database_id || input.id || '').trim()
        return { url: `${baseUrl}/databases/${dbId}`, method: 'GET' }
      }
      case 'query_database': {
        const dbId = String(input.database_id || input.id || '').trim()
        return { url: `${baseUrl}/databases/${dbId}/query`, method: 'POST', body: input.filter ? { filter: input.filter } : {} }
      }
      case 'create_page': {
        const parentId = String(input.parent_id || input.database_id || input.page_id || '').trim()
        const title = String(input.title || input.name || 'Nueva Página').trim()
        const isPage = input.parent_type === 'page' || input.parent_type === 'page_id' || Boolean(input.page_id)
        
        let props = input.properties as Record<string, unknown> | undefined
        if (!props) {
          props = isPage
            ? { title: { title: [{ text: { content: title } }] } }
            : { title: { title: [{ text: { content: title } }] } }
        }
        
        return {
          url: `${baseUrl}/pages`,
          method: 'POST',
          body: {
            parent: isPage ? { page_id: parentId } : { database_id: parentId },
            properties: props,
          },
        }
      }
      case 'append_block': {
        const blockId = String(input.block_id || input.page_id || input.id || '').trim()
        const content = String(input.content || input.text || '').trim()
        const children = (input.children as any[]) || markdownToNotionBlocks(content)
        return {
          url: `${baseUrl}/blocks/${blockId}/children`,
          method: 'PATCH',
          body: { children },
        }
      }
      default:
        return null
    }
  }

  return null
}

/** Ejecuta una llamada directa a la API REST de Google con el token OAuth */
async function executeGoogleApiCall(serverId: string, toolName: string, input: Record<string, unknown>): Promise<string> {
  let oauthToken: string | null = null
  try { oauthToken = vaultGetKey(`mcp:${serverId}:oauth_token`) } catch { /* ignore */ }

  if (!oauthToken) {
    return `Error: No se encontró un token OAuth para "${serverId}". Autoriza el conector en el panel de Conectores MCP.`
  }

  const apiCall = resolveGoogleApiCall(serverId, toolName, input)
  if (!apiCall) {
    if ((toolName === 'send_message' || toolName === 'create_draft') && !resolveField(input, 'to', 'recipient', 'email', 'to_email', 'destinatario')) {
      return `Error: La herramienta "${toolName}" requiere la dirección del destinatario (parámetro "to").`
    }
    return `Error: La herramienta "${toolName}" no tiene un endpoint REST configurado para "${serverId}".`
  }

  try {
    const contentType = apiCall.contentType || 'application/json'
    const headers: Record<string, string> = {
      Authorization: `Bearer ${oauthToken}`,
      'Content-Type': contentType,
    }
    if (serverId === 'notion') {
      headers['Notion-Version'] = '2022-06-28'
    }

    const fetchOpts: RequestInit = {
      method: apiCall.method,
      headers,
      signal: AbortSignal.timeout(30_000),
    }

    if (apiCall.method !== 'GET') {
      if (apiCall.rawBody !== undefined) {
        fetchOpts.body = apiCall.rawBody
      } else if (apiCall.body !== undefined) {
        fetchOpts.body = contentType === 'application/json' ? JSON.stringify(apiCall.body) : String(apiCall.body)
      }
    }

    const resp = await fetch(apiCall.url, fetchOpts)

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => '')
      return `Error HTTP ${resp.status} de la API de ${serverId}: ${errorText.slice(0, 500)}`
    }

    const data = await resp.json()

    // Para list_messages, obtener detalles (Subject, From, Date) de cada mensaje
    if (serverId === 'gmail' && toolName === 'list_messages' && data.messages) {
      const details = await Promise.all(
        data.messages.slice(0, 10).map(async (msg: { id: string }) => {
          try {
            const msgResp = await fetch(
              `${googleApiBaseUrls.gmail}/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              {
                headers: { Authorization: `Bearer ${oauthToken}` },
                signal: AbortSignal.timeout(10_000),
              },
            )
            if (!msgResp.ok) return { id: msg.id, error: `HTTP ${msgResp.status}` }
            return await msgResp.json()
          } catch {
            return { id: msg.id, error: 'timeout' }
          }
        }),
      )
      return JSON.stringify({ messages: details, resultSizeEstimate: data.resultSizeEstimate }, null, 2)
    }

    return JSON.stringify(data, null, 2)
  } catch (err) {
    return `Error al llamar a la API de ${serverId}: ${err instanceof Error ? err.message : String(err)}`
  }
}

/**
 * Ejecuta una herramienta y retorna su output como string.
 */
export async function executeToolCall(ctx: ToolCallContext): Promise<string> {
  const { sessionId, messageId, toolCallId, toolName, toolInput } = ctx

  // ── web_search ──
  if (toolName === 'web_search') {
    const query = typeof toolInput.query === 'string' ? toolInput.query : JSON.stringify(toolInput)

    sendToRenderer({ sessionId, messageId, type: 'search:progress', stage: 'searching', query, tool_call_id: toolCallId })
    sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: `Buscando en la web: "${query}"...` })

    const output = await executeWebSearch(query)

    sendToRenderer({ sessionId, messageId, type: 'search:progress', stage: 'done', tool_call_id: toolCallId })
    return output
  }

  // ── web_fetch ──
  if (toolName === 'web_fetch') {
    const url = typeof toolInput.url === 'string' ? toolInput.url.trim() : ''

    sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: url ? `Obteniendo ${url}...` : 'Obteniendo página web...' })
    sendToRenderer({ sessionId, messageId, type: 'search:progress', stage: 'searching', query: url, tool_call_id: toolCallId })

    const output = await executeWebFetch(url)

    sendToRenderer({ sessionId, messageId, type: 'search:progress', stage: 'done', tool_call_id: toolCallId })
    return output
  }

  // ── MCP tool (serverId__toolName) ──
  if (toolName.includes('__')) {
    const parts = toolName.split('__')
    const serverId = parts[0]
    const realToolName = parts.slice(1).join('_')

    sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: `Ejecutando herramienta MCP ${realToolName} (${serverId})...` })

    // Google API backed services (gmail, google-drive, google-calendar)
    if (googleApiBaseUrls[serverId]) {
      return await executeGoogleApiCall(serverId, realToolName, toolInput)
    }

    // Otherwise, try via McpProcessManager for STDIO/HTTP MCP servers
    try {
      let serverConfig: Record<string, unknown> | undefined
      if (ctx.mcpServers && ctx.mcpServers.length > 0) {
        const match = ctx.mcpServers.find((s: any) => s.id === serverId || s.name === serverId)
        if (match) serverConfig = match as Record<string, unknown>
      }

      const result = await McpProcessManager.getInstance().callTool(serverId, realToolName, toolInput, serverConfig)
      return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    } catch (err) {
      return `Error al ejecutar herramienta MCP "${realToolName}": ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // ── Filesystem tools (list_directory, read_file, write_file, etc.) ──
  if (isMainProcessFileTool(toolName)) {
    sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: `Ejecutando ${toolName}...` })
    try {
      return await executeMainProcessFileTool(
        toolName,
        toolInput as Record<string, unknown>,
        ctx.connectedFolder || ctx.workspaceRoot,
      )
    } catch (err) {
      return `Error ejecutando ${toolName}: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // ── run_command ──
  if (toolName === 'run_command') {
    const command = typeof toolInput.command === 'string' ? toolInput.command : JSON.stringify(toolInput)
    sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: `Ejecutando comando: ${command}...` })
    try {
      const res = await runCommandForAgent(
        toolCallId,
        command,
        (toolInput.cwd as string) || ctx.connectedFolder || ctx.workspaceRoot,
      )
      return res.output
    } catch (err) {
      return `Error ejecutando comando: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // ── Fallback ──
  return `Herramienta ${toolName} ejecutada.`
}
