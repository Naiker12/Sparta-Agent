/**
 * McpToolSchemaAdapter.ts
 * Transformador universal de esquemas JSON Schema de herramientas MCP
 * al formato nativo exigido por cada proveedor de IA (OpenAI, Anthropic, Gemini).
 */

export interface MCPToolDefinition {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export type LLMVendor = 'openai' | 'anthropic' | 'google' | 'gemini' | 'ollama'

export interface OpenAIToolFormat {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface AnthropicToolFormat {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface GeminiToolFormat {
  functionDeclarations: Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
}

export class McpToolSchemaAdapter {
  /**
   * Adapta una herramienta MCP al formato exigido por el proveedor seleccionado.
   */
  public static mapToolToProvider(
    tool: MCPToolDefinition,
    vendor: LLMVendor
  ): OpenAIToolFormat | AnthropicToolFormat | GeminiToolFormat | MCPToolDefinition {
    const name = tool.name
    const description = tool.description || `Herramienta MCP ${name}`
    const parameters = this.sanitizeInputSchema(tool.inputSchema)

    switch (vendor) {
      case 'openai':
      case 'ollama':
        return {
          type: 'function',
          function: {
            name,
            description,
            parameters,
          },
        }

      case 'anthropic':
        return {
          name,
          description,
          input_schema: parameters,
        }

      case 'google':
      case 'gemini':
        return {
          functionDeclarations: [
            {
              name,
              description,
              parameters,
            },
          ],
        }

      default:
        return {
          name,
          description,
          inputSchema: parameters,
        }
    }
  }

  /**
   * Asegura que el inputSchema sea un objeto JSON Schema válido con 'type: object' y 'properties'.
   */
  private static sanitizeInputSchema(schema?: Record<string, unknown>): Record<string, unknown> {
    if (!schema || typeof schema !== 'object') {
      return {
        type: 'object',
        properties: {},
      }
    }

    const type = schema.type || 'object'
    const properties = (schema.properties && typeof schema.properties === 'object')
      ? schema.properties
      : {}
    const required = Array.isArray(schema.required) ? schema.required : undefined

    return {
      type,
      properties,
      ...(required ? { required } : {}),
    }
  }

  /**
   * Convierte un listado de herramientas MCP al formato esperado por el proveedor.
   */
  public static formatToolsList(tools: MCPToolDefinition[], vendor: LLMVendor): unknown[] {
    return tools.map((t) => this.mapToolToProvider(t, vendor))
  }
}
