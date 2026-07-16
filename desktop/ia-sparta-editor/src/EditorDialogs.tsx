export function UnsavedChangesDialog({
  fileName,
  onSave,
  onDiscard,
  onCancel,
}: {
  fileName: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={onCancel}
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
        <div style={{ padding: '20px 24px 12px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
            Cambios sin guardar
          </h3>
        </div>
        <div style={{ padding: '0 24px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.5, margin: 0 }}>
            <span style={{ fontWeight: 600 }}>{fileName}</span> tiene cambios sin guardar.
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '12px 24px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          <button onClick={onCancel} style={{
            padding: '5px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={onDiscard} style={{
            padding: '5px 12px', background: 'transparent', border: '1px solid var(--border-normal)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          }}>
            Descartar
          </button>
          <button onClick={onSave} style={{
            padding: '5px 12px', background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius-md)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 500,
          }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
