import { usePermissionStore } from '../stores/permission.store'
import type { PermissionActionKind, PermissionRule } from '../types/permission.types'

export type EvaluationResult = 'allow' | 'deny' | 'prompt'

/**
 * Service to evaluate permission requests in real-time against active security rules and presets.
 */
export class PermissionEvaluatorService {
  /**
   * Evaluates an incoming tool call or file/network action against configured security rules.
   */
  static evaluate(kind: PermissionActionKind, target: string, workspacePath?: string): EvaluationResult {
    const store = usePermissionStore.getState()

    // 1. Check explicit rules matching target
    const rules = this.getRulesForKind(store, kind)
    const matchingRule = this.findMatchingRule(rules, target)

    if (matchingRule) {
      return matchingRule.effect
    }

    // 2. Fall back to Security Preset policies
    const preset = store.securityPreset

    if (preset === 'strict') {
      // In strict mode, any unlisted action requires explicit prompt or is denied
      return 'prompt'
    }

    if (preset === 'permissive') {
      // Permissive auto-approves reads and safe dev tools inside workspace
      if (kind === 'file_read') return 'allow'
      if (workspacePath && target.startsWith(workspacePath)) return 'allow'
      if (kind === 'terminal_command' && (target.startsWith('git ') || target.startsWith('pnpm ') || target.startsWith('npm '))) {
        return 'allow'
      }
    }

    // Default policy
    if (kind === 'file_read') {
      if (workspacePath && target.startsWith(workspacePath)) {
        return 'allow'
      }
    }

    return 'prompt'
  }

  private static getRulesForKind(store: ReturnType<typeof usePermissionStore.getState>, kind: PermissionActionKind): PermissionRule[] {
    switch (kind) {
      case 'file_read':
        return store.fileReads
      case 'file_write':
        return store.fileWrites
      case 'network_url':
        return store.networkRules
      case 'terminal_command':
        return store.terminalRules
      case 'unsandboxed_command':
        return store.unsandboxedRules
      case 'mcp_tool':
        return store.mcpRules
      default:
        return []
    }
  }

  private static findMatchingRule(rules: PermissionRule[], target: string): PermissionRule | undefined {
    const normalizedTarget = target.toLowerCase().trim()
    return rules.find((rule) => {
      const normRuleTarget = rule.target.toLowerCase().trim()
      if (normRuleTarget === '*') return true
      if (normRuleTarget === normalizedTarget) return true
      if (normRuleTarget.endsWith('*') && normalizedTarget.startsWith(normRuleTarget.slice(0, -1))) {
        return true
      }
      return normalizedTarget.startsWith(normRuleTarget)
    })
  }
}
