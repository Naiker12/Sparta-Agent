import { AlertTriangle } from 'lucide-react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  itemLabel: string
  onConfirm: () => void
}

export function ConfirmDeleteDialog({
  open, onOpenChange, title = '¿Eliminar este elemento?', itemLabel, onConfirm,
}: ConfirmDeleteDialogProps) {
  function handleConfirm() {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} width={420} maxHeight={240}>
      <ModalHeader title={(
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--status-err)',
            flexShrink: 0,
          }}>
            <AlertTriangle size={15} strokeWidth={2.25} />
          </span>
          {title}
        </span>
      )} onClose={() => onOpenChange(false)} />
      <ModalBody style={{ padding: '0 24px 20px' }}>
        <p style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          lineHeight: 1.5,
        }}>
          Vas a eliminar{' '}
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{itemLabel}</span>
          . Esta acción no se puede deshacer.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={handleConfirm}>
          Eliminar
        </Button>
      </ModalFooter>
    </Modal>
  )
}
