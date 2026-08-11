import type { PermissionActionKind, PermissionDecision } from 'ia-sparta-contracts'

export interface MainPermissionRule {
  action: PermissionActionKind
  target: string
  effect: Extract<PermissionDecision, 'allow' | 'deny'>
}

export interface PermissionEvaluationInput {
  action: PermissionActionKind
  target: string
  workspaceRoot?: string
  preset: 'default' | 'strict' | 'permissive'
  rules: MainPermissionRule[]
}

export function evaluatePermission(input: PermissionEvaluationInput): PermissionDecision {
  const matching = input.rules.filter((rule) => rule.action === input.action && matches(rule.target, input.target))
  if (matching.some((rule) => rule.effect === 'deny')) return 'deny'
  if (matching.some((rule) => rule.effect === 'allow')) return 'allow'

  if (input.preset === 'strict') return 'prompt'
  if (input.action === 'file_read' && isWithinWorkspace(input.target, input.workspaceRoot)) return 'allow'
  if (input.preset === 'permissive' && isWithinWorkspace(input.target, input.workspaceRoot)) return 'allow'
  return 'prompt'
}

function matches(ruleTarget: string, target: string): boolean {
  const rule = ruleTarget.trim().toLowerCase()
  const value = target.trim().toLowerCase()
  if (rule === '*') return true
  if (rule.endsWith('*')) return value.startsWith(rule.slice(0, -1))
  return value === rule
}

function isWithinWorkspace(target: string, workspaceRoot?: string): boolean {
  if (!workspaceRoot) return false
  const root = workspaceRoot.replace(/[\\/]+$/, '').toLowerCase()
  const value = target.toLowerCase()
  return value === root || value.startsWith(`${root}/`) || value.startsWith(`${root}\\`)
}
