/**
 * McpPermissionsMiddleware.ts
 * Middleware de seguridad que evalúa las reglas mcpRules en runtime
 * antes de permitir la ejecución de mcp:call-tool.
 */

export type MCPPermissionAction = 'allow' | 'ask' | 'deny'

export interface MCPRuleDefinition {
  id?: string
  serverId: string
  toolPattern: string
  action: MCPPermissionAction
}

export class McpPermissionsMiddleware {
  private rules: MCPRuleDefinition[] = []

  constructor(rules: MCPRuleDefinition[] = []) {
    this.rules = rules
  }

  public setRules(rules: MCPRuleDefinition[]): void {
    this.rules = rules
  }

  /**
   * Evalúa la regla aplicable para un servidor y herramienta MCP específicos.
   */
  public evaluate(serverId: string, toolName: string): MCPPermissionAction {
    if (!this.rules || this.rules.length === 0) {
      // Regla por defecto: las lecturas se permiten, las escrituras requieren 'ask'
      return this.isWriteOperation(toolName) ? 'ask' : 'allow'
    }

    // Buscar coincidencia explícita por servidor y patrón de herramienta
    for (const rule of this.rules) {
      if (
        (rule.serverId === '*' || rule.serverId === serverId) &&
        this.matchPattern(toolName, rule.toolPattern)
      ) {
        return rule.action
      }
    }

    // Fallback por defecto si no hay coincidencia explícita
    return this.isWriteOperation(toolName) ? 'ask' : 'allow'
  }

  /**
   * Compara el nombre de la herramienta con un patrón con comodín (*).
   */
  private matchPattern(toolName: string, pattern: string): boolean {
    if (pattern === '*' || pattern === toolName) return true
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      return regex.test(toolName)
    }
    return false
  }

  /**
   * Determina por convención de nombre si una herramienta modifica estado (escritura).
   */
  private isWriteOperation(toolName: string): boolean {
    const lower = toolName.toLowerCase()
    const writePrefixes = ['create', 'add', 'insert', 'update', 'delete', 'remove', 'write', 'post', 'put', 'push']
    return writePrefixes.some((prefix) => lower.includes(prefix))
  }
}
