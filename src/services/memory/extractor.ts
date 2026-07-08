/**
 * extractor.ts
 *
 * Automatic memory capture for completed chat turns.
 *
 * One completed assistant response becomes one memory node. The graph then
 * links that node to the previous response from the same session. This keeps
 * memory useful without exploding into one node per token/entity/keyword.
 */

import { useSettingsStore } from '@/stores/settings.store'
import { useMemoryStore } from '@/stores/memory.store'
import type { MemoryEntry } from '@/types'

const TURN_CATEGORY = 'conversation_turn'
const MIN_TURN_LENGTH = 80

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

function shouldStoreTurn(userText: string, assistantText: string): boolean {
  const user = cleanText(userText)
  const assistant = cleanText(assistantText)
  if (!user || !assistant) return false
  if (assistant.startsWith('Error:')) return false
  return `${user}\n${assistant}`.length >= MIN_TURN_LENGTH
}

function buildTurnContent(userText: string, assistantText: string): string {
  return [
    'Usuario:',
    cleanText(userText),
    '',
    'Respuesta:',
    cleanText(assistantText),
  ].join('\n')
}

function findPreviousTurn(entries: MemoryEntry[], sessionId: string, messageId: string): MemoryEntry | undefined {
  return entries
    .filter((entry) =>
      entry.category === TURN_CATEGORY &&
      entry.source === 'auto' &&
      entry.sourceSessionId === sessionId &&
      entry.sourceMessageId !== messageId
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0]
}

export async function extractMemory(
  userText: string,
  assistantText: string,
  sessionId: string,
  messageId: string
): Promise<void> {
  if (!useSettingsStore.getState().memoryEnabled) return
  if (!shouldStoreTurn(userText, assistantText)) return

  try {
    const store = useMemoryStore.getState()
    const existing = store.entries

    if (existing.some((entry) => entry.sourceMessageId === messageId && entry.category === TURN_CATEGORY)) {
      return
    }

    const previousTurn = findPreviousTurn(existing, sessionId, messageId)
    const content = buildTurnContent(userText, assistantText)
    const entryId = store.addEntry(content, 'auto', TURN_CATEGORY, undefined, sessionId, messageId)

    if (previousTurn) {
      store.addRelation({
        fromId: previousTurn.id,
        toId: entryId,
        type: 'same_session',
        weight: 0.95,
        entityType: 'next_turn',
      })
    }

    store.rebuildGraph()
    console.debug(`[memory:extractor] stored completed turn as one node id=${entryId.slice(0, 8)}`)

    import('./index').then(({ isVectorEnabled, indexInChroma }) => {
      if (!isVectorEnabled()) return
      const entry = useMemoryStore.getState().entries.find((item) => item.id === entryId)
      if (entry) void indexInChroma(entry)
    }).catch(() => {})
  } catch (err) {
    console.error('[memory:extractor] Failed:', err)
  }
}
