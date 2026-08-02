import { useSettingsStore } from '../../stores/settings.store'
import { useMemoryStore } from '../../stores/memory.store'
import type { MemoryEntry } from '../../types'

const MIN_USER_LENGTH = 12
const MIN_COMBINED_LENGTH = 90

const TRIVIAL_PATTERNS = [
  /^(hola|chao|adios|gracias|ok|dale|listo|entendido|de nada|perfecto|si|no)$/i,
  /^(tu puedes|me lo|xq t|que comando|de que|mira|miren|busca aca|ahora mandale)$/i,
]

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
  if (user.length < MIN_USER_LENGTH) return false
  if (assistant.startsWith('Error:') || assistant.startsWith('Conexión Web:')) return false
  if (TRIVIAL_PATTERNS.some((pattern) => pattern.test(user))) return false
  return `${user}\n${assistant}`.length >= MIN_COMBINED_LENGTH
}

function detectCategory(userText: string, assistantText: string): string {
  const combined = `${userText} ${assistantText}`.toLowerCase()
  if (combined.includes('```') || combined.includes('import ') || combined.includes('function') || combined.includes('const ') || combined.includes('error:')) {
    return 'código'
  }
  if (combined.includes('prefiera') || combined.includes('configur') || combined.includes('ajuste') || combined.includes('regla')) {
    return 'pref.'
  }
  if (combined.includes('mcp') || combined.includes('gmail') || combined.includes('onedrive') || combined.includes('notion') || combined.includes('fetch')) {
    return 'entidad'
  }
  if (combined.includes('proyecto') || combined.includes('workspace') || combined.includes('archivo') || combined.includes('d:\\')) {
    return 'proyecto'
  }
  return 'entidad'
}

function buildTurnContent(userText: string, assistantText: string): string {
  const cleanUser = cleanText(userText)
  const cleanAssistant = cleanText(assistantText).split('\n').slice(0, 5).join('\n')
  return `${cleanUser}\n→ ${cleanAssistant}`.trim()
}

function findPreviousTurn(entries: MemoryEntry[], sessionId: string, messageId: string): MemoryEntry | undefined {
  return entries
    .filter((entry) =>
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

    if (existing.some((entry) => entry.sourceMessageId === messageId)) {
      return
    }

    const previousTurn = findPreviousTurn(existing, sessionId, messageId)
    const category = detectCategory(userText, assistantText)
    const content = buildTurnContent(userText, assistantText)
    const entryId = store.addEntry(content, 'auto', category, undefined, sessionId, messageId)

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
    console.debug(`[memory:extractor] stored high-value turn id=${entryId.slice(0, 8)} category=${category}`)

    import('./index').then(({ isVectorEnabled, indexInChroma }) => {
      if (!isVectorEnabled()) return
      const entry = useMemoryStore.getState().entries.find((item) => item.id === entryId)
      if (entry) void indexInChroma(entry)
    }).catch(() => {})
  } catch (err) {
    console.error('[memory:extractor] Failed:', err)
  }
}
