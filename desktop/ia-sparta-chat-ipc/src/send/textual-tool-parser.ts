/**
 * textual-tool-parser.ts
 * Parser para extraer y convertir llamadas a herramientas en texto plano / XML / markdown
 * emitidas por modelos que no usan deltas JSON nativos (ej: <tool_call>, <function_call>, ```tool_call).
 */

export interface ExtractedToolCall {
  id: string
  toolName: string
  input: Record<string, unknown>
  rawMatch: string
}

export function parseParamString(paramStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const trimmed = paramStr.trim()
  if (!trimmed) return result

  // Si es un JSON directo
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // Fallthrough
    }
  }

  // Parsear formato clave="valor" o clave='valor' o clave=123
  const regex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\s)]+))/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(paramStr)) !== null) {
    const key = match[1]
    const value = match[2] ?? match[3] ?? match[4]
    if (value !== undefined) {
      // Intentar convertir números o booleanos si aplica
      if (value === 'true') result[key] = true
      else if (value === 'false') result[key] = false
      else if (!isNaN(Number(value)) && value.trim() !== '') result[key] = Number(value)
      else result[key] = value
    }
  }

  // Si no se pudo parsear como clave=valor y parece una query de búsqueda directa
  if (Object.keys(result).length === 0 && trimmed.length > 0) {
    result.query = trimmed.replace(/^["']|["']$/g, '')
  }

  return result
}

export function extractTextualToolCalls(content: string): {
  cleanedContent: string
  toolCalls: ExtractedToolCall[]
} {
  const toolCalls: ExtractedToolCall[] = []
  let cleaned = content

  // 1. Patrón: <tool_call>name(params)</tool_call> o <tool_call>name(params)> o <tool_call>name(...)
  const xmlFuncRegex = /<tool_call>\s*([a-zA-Z0-9_.-]+)\(([\s\S]*?)\)\s*(?:<\/tool_call>|>)?/gi
  cleaned = cleaned.replace(xmlFuncRegex, (fullMatch, name, args) => {
    toolCalls.push({
      id: `text_call_${Date.now()}_${toolCalls.length}`,
      toolName: name.trim(),
      input: parseParamString(args),
      rawMatch: fullMatch,
    })
    return ''
  })

  // 2. Patrón: <function_call>\s*([a-zA-Z0-9_.-]+)\(([\s\S]*?)\)\s*(?:<\/function_call>|>)?
  const funcCallRegex = /<function_call>\s*([a-zA-Z0-9_.-]+)\(([\s\S]*?)\)\s*(?:<\/function_call>|>)?/gi
  cleaned = cleaned.replace(funcCallRegex, (fullMatch, name, args) => {
    toolCalls.push({
      id: `text_call_${Date.now()}_${toolCalls.length}`,
      toolName: name.trim(),
      input: parseParamString(args),
      rawMatch: fullMatch,
    })
    return ''
  })

  // 3. Patrón: <tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>
  const xmlJsonRegex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/gi
  cleaned = cleaned.replace(xmlJsonRegex, (fullMatch, jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr)
      const name = parsed.name || parsed.tool || parsed.toolName || 'web_search'
      const input = parsed.input || parsed.parameters || parsed.arguments || parsed
      toolCalls.push({
        id: `text_call_${Date.now()}_${toolCalls.length}`,
        toolName: name,
        input: typeof input === 'object' && input !== null ? input : { query: String(input) },
        rawMatch: fullMatch,
      })
      return ''
    } catch {
      return fullMatch
    }
  })

  // 4. Patrón: ```tool_call\n(\{[\s\S]*?\})\n```
  const codeBlockRegex = /```(?:tool_call|tool|function_call)\s*([\s\S]*?)```/gi
  cleaned = cleaned.replace(codeBlockRegex, (fullMatch, blockContent) => {
    const trimmed = blockContent.trim()
    try {
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed)
        const name = parsed.name || parsed.tool || parsed.toolName || 'web_search'
        const input = parsed.input || parsed.parameters || parsed.arguments || parsed
        toolCalls.push({
          id: `text_call_${Date.now()}_${toolCalls.length}`,
          toolName: name,
          input: typeof input === 'object' && input !== null ? input : { query: String(input) },
          rawMatch: fullMatch,
        })
        return ''
      }
    } catch {
      // Ignorar fallo de parseo
    }
    return fullMatch
  })

  return {
    cleanedContent: cleaned.trim(),
    toolCalls,
  }
}
