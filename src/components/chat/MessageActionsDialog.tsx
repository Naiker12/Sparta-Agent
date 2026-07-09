import type { Message } from '@/types'
import { useChatStore } from '@/stores/chat.store'
import { useMemoryStore } from '@/stores/memory.store'
import { useEventBus } from '@/stores/event-bus.store'
import { useChatSession } from '@/hooks/useChatSession'
import { deleteEntry as chromaDeleteEntry } from '@/services/memory/vector/chroma-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type DialogState =
  | { kind: 'none' }
  | { kind: 'delete' }
  | { kind: 'regenerate' }

interface MessageActionsDialogProps {
  message: Message
  sessionId: string
  state: DialogState
  onClose: () => void
}

export function MessageActionsDialog({
  message,
  sessionId,
  state,
  onClose,
}: MessageActionsDialogProps) {
  const { deleteMessage } = useChatStore()
  const dispatch = useEventBus((s) => s.dispatch)
  const { sendMessage } = useChatSession()

  const isOpen = state.kind !== 'none'

  function handleDelete() {
    deleteMessage(sessionId, message.id)
    const entryIds = useMemoryStore.getState().deleteEntriesBySourceMessageId(message.id)
    if (entryIds.length > 0) {
      Promise.all(entryIds.map((id) => chromaDeleteEntry(id))).catch(() => {})
    }
    dispatch({
      type: 'message:deleted',
      sessionId,
      messageId: message.id,
      timestamp: Date.now(),
    })
    onClose()
  }

  const title =
    state.kind === 'delete' ? 'Eliminar mensaje' :
    state.kind === 'regenerate' ? 'Regenerar respuesta' : ''

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-2">
          {state.kind === 'delete' && (
            <p style={{
              fontSize: 13, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)', lineHeight: 1.6,
            }}>
              Vas a eliminar{' '}
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {message.content.length > 60
                  ? message.content.slice(0, 60) + '...'
                  : message.content}
              </span>
              . Esta acción no se puede deshacer.
            </p>
          )}

          {state.kind === 'regenerate' && (
            <p style={{
              fontSize: 13, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)', lineHeight: 1.6,
            }}>
              Se volverá a pedir al agente una respuesta. ¿Continuar?
            </p>
          )}
        </div>

        <DialogFooter>
          {state.kind === 'delete' && (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>Eliminar</Button>
            </>
          )}
          {state.kind === 'regenerate' && (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={() => { sendMessage(message.content); onClose() }}>Regenerar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
