import type { MessagePart } from '../types'

export interface ReasoningGroup {
  kind: 'reasoning'
  id: string
  text: string
  isStreaming: boolean
  startedAt: number
  completedAt?: number
}

export type AssistantRenderGroup =
  | ReasoningGroup
  | (MessagePart & { kind: 'text' })
  | (MessagePart & { kind: 'tool' })
  | (MessagePart & { kind: 'subagent' })

const COLLAPSED_STEP_RUN_MIN_ROWS = 3

function isReasoningPart(part: MessagePart): part is MessagePart & { kind: 'reasoning' } {
  return part.kind === 'reasoning'
}

function isRenderablePart(part: MessagePart): boolean {
  return part.kind === 'reasoning' || part.kind === 'text' || part.kind === 'tool' || part.kind === 'subagent'
}

export function getAssistantRenderGroups(parts: MessagePart[], isStreaming: boolean): AssistantRenderGroup[] {
  const filtered = parts.filter(isRenderablePart)
  const groups: AssistantRenderGroup[] = []

  for (const part of filtered) {
    if (isReasoningPart(part)) {
      const previous = groups[groups.length - 1]
      if (previous?.kind === 'reasoning') {
        const sep = previous.text && part.text.trim() ? '\n\n' : ''
        previous.text += sep + part.text
        previous.isStreaming = previous.isStreaming || (!part.completedAt && isStreaming)
        if (!part.completedAt) previous.completedAt = undefined
        continue
      }

      if (!part.text.trim()) continue

      groups.push({
        kind: 'reasoning',
        id: `merged-${part.id}`,
        text: part.text,
        isStreaming: isStreaming && !part.completedAt,
        startedAt: part.startedAt,
        completedAt: part.completedAt,
      })
      continue
    }

    groups.push(part as AssistantRenderGroup)
  }

  return groups
}

export interface SplitTurn {
  steps: AssistantRenderGroup[]
  answer: AssistantRenderGroup[]
}

export function splitTurnAtAnswer(parts: MessagePart[], isStreaming: boolean): SplitTurn | null {
  if (isStreaming) return null

  let answerStart = -1
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    if (p.kind === 'text' && p.content.trim()) {
      answerStart = i
      break
    }
  }

  if (answerStart <= 0) return null

  const stepParts = parts.slice(0, answerStart)
  const hasWork = stepParts.some(
    p => p.kind === 'reasoning' || p.kind === 'tool' || p.kind === 'subagent'
  )
  if (!hasWork) return null

  return {
    steps: getAssistantRenderGroups(stepParts, false),
    answer: getAssistantRenderGroups(parts.slice(answerStart), false),
  }
}

export function getStepRunLabel(
  groups: AssistantRenderGroup[],
  startedAt?: number,
  completedAt?: number,
): string {
  const stepRowCount = groups.filter(g => g.kind !== 'text').length
  if (startedAt !== undefined && completedAt !== undefined && completedAt > startedAt) {
    const duration = Math.round((completedAt - startedAt) / 1000)
    if (duration < 60) return `Worked for ${duration}s`
    const mins = Math.floor(duration / 60)
    const secs = duration % 60
    return secs > 0 ? `Worked for ${mins}m ${secs}s` : `Worked for ${mins}m`
  }
  return stepRowCount === 1 ? '1 step' : `${stepRowCount} steps`
}

export function shouldCollapseSteps(groups: AssistantRenderGroup[]): boolean {
  const nonTextCount = groups.filter(g => g.kind !== 'text').length
  return nonTextCount > COLLAPSED_STEP_RUN_MIN_ROWS
}
