import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Message } from '@/types'
import { useChatStore } from '@/stores/chat.store'
import { useEventBus } from '@/stores/event-bus.store'

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
  const [editValue, setEditValue] = useState(message.content)
  const [copied, setCopied] = useState(false)
  const [shareLink] = useState(
    `sparta://share/${sessionId}/${message.id}`
  )

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
    dispatch({
      type: 'message:deleted',
      sessionId,
      messageId: message.id,
      timestamp: Date.now(),
    })
    onClose()
  }

  function handleShareCopy() {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        {state.kind === 'delete' && (
          <>
            <DialogHeader>
              <DialogTitle>Eliminar mensaje</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Vas a eliminar{' '}
                <span
                  className="font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {message.content.length > 60
                    ? message.content.slice(0, 60) + '...'
                    : message.content}
                </span>
                . Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                Eliminar
              </Button>
            </DialogFooter>
          </>
        )}

        {state.kind === 'share' && (
          <>
            <DialogHeader>
              <DialogTitle>Compartir mensaje</DialogTitle>
              <DialogDescription>
                Copia este enlace para compartir el mensaje con otros.
              </DialogDescription>
            </DialogHeader>
            <div style={{ padding: '0 24px 20px' }}>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 10px',
                }}
              >
                <code
                  style={{
                    flex: 1,
                    fontSize: 11,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shareLink}
                </code>
                <Button size="xs" variant="ghost" onClick={handleShareCopy}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}

        {state.kind === 'edit' && (
          <>
            <DialogHeader>
              <DialogTitle>Editar mensaje</DialogTitle>
              <DialogDescription>
                Cambia el contenido. Se reenviará al agente al guardar.
              </DialogDescription>
            </DialogHeader>
            <div style={{ padding: '0 24px 20px' }}>
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={5}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCopy} variant="outline">
                <Copy size={12} /> Copiar
              </Button>
              <Button size="sm" onClick={handleEdit} disabled={!editValue.trim()}>
                Guardar y reenviar
              </Button>
            </DialogFooter>
          </>
        )}

        {state.kind === 'regenerate' && (
          <>
            <DialogHeader>
              <DialogTitle>Regenerar respuesta</DialogTitle>
              <DialogDescription>
                Se volverá a pedir al agente una respuesta. ¿Continuar?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleRegenerate}>Regenerar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
