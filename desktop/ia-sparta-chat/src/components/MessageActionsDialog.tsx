import type { Message } from 'ia-sparta-core'
import { useChatStore } from 'ia-sparta-core'
import { useMemoryStore } from 'ia-sparta-core'
import { useEventBus } from 'ia-sparta-core'
import { useChatSession } from 'ia-sparta-core'
import { deleteEntry as chromaDeleteEntry } from 'ia-sparta-core'
import { ConfirmDeleteDialog, ConfirmActionDialog } from 'ia-sparta-design-system'

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

  const preview = message.content.length > 60
    ? message.content.slice(0, 60) + '...'
    : message.content

  return (
    <>
      <ConfirmDeleteDialog
        open={state.kind === 'delete'}
        onOpenChange={(open) => { if (!open) onClose() }}
        title="¿Eliminar este mensaje?"
        itemLabel={preview}
        onConfirm={handleDelete}
      />
      <ConfirmActionDialog
        open={state.kind === 'regenerate'}
        onOpenChange={(open) => { if (!open) onClose() }}
        title="Regenerar respuesta"
        description="Se volverá a pedir al agente una respuesta. ¿Continuar?"
        confirmLabel="Regenerar"
        onConfirm={() => { sendMessage(message.content); onClose() }}
      />
    </>
  )
}
