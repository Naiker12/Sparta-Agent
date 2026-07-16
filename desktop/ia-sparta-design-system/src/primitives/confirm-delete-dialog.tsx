import { AlertTriangle, X } from 'lucide-react'
import { Button } from './button'
import type { ReactNode } from 'react'

interface ConfirmDialogShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  icon?: ReactNode
  iconBg?: string
  iconColor?: string
  children: ReactNode
  confirmLabel?: string
  confirmVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  onConfirm: () => void
}

export function ConfirmDialogShell({
  open,
  onOpenChange,
  title,
  icon,
  iconBg = 'rgba(239, 68, 68, 0.12)',
  iconColor = 'var(--status-err)',
  children,
  confirmLabel = 'Confirmar',
  confirmVariant = 'default',
  onConfirm,
}: ConfirmDialogShellProps) {
  function handleConfirm() {
    onConfirm()
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={() => onOpenChange(false)}
    >
      <div
        style={{
          width: 420, maxWidth: '92vw',
          background: 'var(--bg-modal)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          padding: '20px 24px 0', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 'var(--radius-md)',
              background: iconBg, color: iconColor, flexShrink: 0,
            }}>
              {icon ?? <AlertTriangle size={15} strokeWidth={2.25} />}
            </span>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
              {title}
            </h3>
          </div>
          <button onClick={() => onOpenChange(false)} style={{
            width: 24, height: 24, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: -2,
          }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '12px 24px 20px' }}>
          {children}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '12px 24px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant={confirmVariant} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Delete variant ──────────────────────────────────────────────────

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  itemLabel: string
  onConfirm: () => void
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = '¿Eliminar este elemento?',
  itemLabel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <ConfirmDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      iconBg="rgba(239, 68, 68, 0.12)"
      iconColor="var(--status-err)"
      confirmLabel="Eliminar"
      confirmVariant="destructive"
      onConfirm={onConfirm}
    >
      <p style={{
        fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
        lineHeight: 1.5, margin: 0,
      }}>
        Vas a eliminar{' '}
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{itemLabel}</span>.
        Esta acción no se puede deshacer.
      </p>
    </ConfirmDialogShell>
  )
}

// ── Action variant (e.g. regenerate) ────────────────────────────────

interface ConfirmActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <ConfirmDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      iconBg="rgba(234, 179, 8, 0.12)"
      iconColor="var(--status-warn)"
      confirmLabel={confirmLabel}
      confirmVariant="default"
      onConfirm={onConfirm}
    >
      <p style={{
        fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
        lineHeight: 1.5, margin: 0,
      }}>
        {description}
      </p>
    </ConfirmDialogShell>
  )
}
