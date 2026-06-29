import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Message } from '@/types'
import { useChatStore } from '@/stores/chat.store'
import { useEventBus } from '@/stores/event-bus.store'
import { useChatSession } from '@/hooks/useChatSession'

type DialogState =
  | { kind: 'none' }
  | { kind: 'delete' }
  | { kind: 'share' }
  | { kind: 'edit' }
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
  const { deleteMessage, updateMessage } = useChatStore()
  const dispatch = useEventBus((s) => s.dispatch)
  const { regenerateMessage } = useChatSession()
  const [editValue, setEditValue] = useState(message.content)
  const [copied, setCopied] = useState(false)

  const isOpen = state.kind !== 'none'

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleDelete() {
    deleteMessage(sessionId, message.id)
    dispatch({
      type: 'message:deleted',
      sessionId,
      messageId: message.id,
      timestamp: Date.now(),
    })
    onClose()
  }

  function handleEdit() {
    if (state.kind !== 'edit') return
    updateMessage(message.id, { content: editValue })
    dispatch({
      type: 'message:edited',
      sessionId,
      messageId: message.id,
      timestamp: Date.now(),
    })
    onClose()
  }

  function handleRegenerate() {
    regenerateMessage(sessionId, message.id)
    onClose()
  }

  function handleShareCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const title =
    state.kind === 'delete' ? 'Eliminar mensaje' :
    state.kind === 'share' ? 'Copiar mensaje' :
    state.kind === 'edit' ? 'Editar mensaje' :
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

          {state.kind === 'share' && (
            <p style={{
              fontSize: 13, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)', lineHeight: 1.6,
            }}>
              Copia el contenido de este mensaje al portapapeles.
            </p>
          )}

          {state.kind === 'edit' && (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={5}
              autoFocus
            />
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
          {state.kind === 'share' && (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
              <Button size="sm" onClick={handleShareCopy}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado' : 'Copiar texto'}
              </Button>
            </>
          )}
          {state.kind === 'edit' && (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={handleCopy} variant="outline"><Copy size={12} /> Copiar</Button>
              <Button size="sm" onClick={handleEdit} disabled={!editValue.trim()}>Guardar y reenviar</Button>
            </>
          )}
          {state.kind === 'regenerate' && (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={handleRegenerate}>Regenerar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
