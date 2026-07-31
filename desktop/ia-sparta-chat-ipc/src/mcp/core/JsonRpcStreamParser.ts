/**
 * JsonRpcStreamParser.ts
 * Parser de streams de texto para JSON-RPC resistente a contaminación de stdout.
 * Filtra advertencias y mensajes informativos impresos por CLI como npx, uvx o npm.
 */

export interface JsonRpcMessage {
  jsonrpc?: string
  id?: number | string
  method?: string
  params?: unknown
  result?: unknown
  error?: {
    code?: number
    message: string
    data?: unknown
  }
}

export class JsonRpcStreamParser {
  private buffer = ''

  /**
   * Procesa un fragmento de datos (Buffer o string) y devuelve únicamente
   * los mensajes JSON-RPC válidos extraídos.
   */
  public parseChunk(chunk: Buffer | string): JsonRpcMessage[] {
    this.buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
    const lines = this.buffer.split(/\r?\n/)
    // La última línea puede estar incompleta, se retiene en el buffer
    this.buffer = lines.pop() ?? ''

    const messages: JsonRpcMessage[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Descartar líneas que claramente no son JSON
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        // Log de información ignorada en stdout
        continue
      }

      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === 'object') {
          messages.push(parsed as JsonRpcMessage)
        }
      } catch {
        // Fragmento JSON incompleto o no válido — ignorar silenciosamente
      }
    }

    return messages
  }

  /**
   * Limpia el buffer retenido.
   */
  public reset(): void {
    this.buffer = ''
  }
}
