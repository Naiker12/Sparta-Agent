import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Message } from '@/types'
import { MessageActionsDialog } from './MessageActionsDialog'

interface MessageActionsMenuProps {
  message: Message
  sessionId: string
}

type DialogState =
  | { kind: 'none' }
  | { kind: 'delete' }
  | { kind: 'share' }
  | { kind: 'edit' }
  | { kind: 'regenerate' }

export function MessageActionsMenu({ message, sessionId }: MessageActionsMenuProps) {
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })
  const isUser = message.role === 'user'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Acciones del mensaje"
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          className="message-actions-trigger"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.borderColor = 'var(--border-normal)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.borderColor = 'var(--border-subtle)'
          }}
        >
          <MoreHorizontal size={13} strokeWidth={1.5} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isUser ? 'end' : 'start'} sideOffset={4}>
          <DropdownMenuItem onClick={() => setDialog({ kind: 'share' })}>
            Compartir
          </DropdownMenuItem>
          {isUser && (
            <DropdownMenuItem onClick={() => setDialog({ kind: 'edit' })}>
              Editar y reenviar
            </DropdownMenuItem>
          )}
          {!isUser && (
            <DropdownMenuItem onClick={() => setDialog({ kind: 'regenerate' })}>
              Regenerar respuesta
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDialog({ kind: 'delete' })}
          >
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MessageActionsDialog
        message={message}
        sessionId={sessionId}
        state={dialog}
        onClose={() => setDialog({ kind: 'none' })}
      />
    </>
  )
}
