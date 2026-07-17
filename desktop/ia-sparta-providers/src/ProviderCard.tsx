import { useState } from 'react'
import { Eye, EyeOff, Pencil, Trash2, Shield } from 'lucide-react'
import type { Provider } from 'ia-sparta-core'
import { useProviderStore, getVendorLabel } from 'ia-sparta-core'
import { ConfirmDeleteDialog } from 'ia-sparta-design-system'
import { BrandIcon } from 'ia-sparta-design-system'
import { useTranslation } from 'ia-sparta-i18n'
import { removeFromVault } from 'ia-sparta-platform'

interface ProviderCardProps {
  provider: Provider
  onEdit: () => void
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 7) + '••••••••' + key.slice(-4)
}

export function ProviderCard({ provider, onEdit }: ProviderCardProps) {
  const { removeProvider } = useProviderStore()
  const [revealed, setRevealed] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const { t } = useTranslation()

  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-normal)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <BrandIcon vendor={provider.vendor} size={14} />
        <span style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          flex: 1,
        }}>
          {getVendorLabel(provider.vendor)}
        </span>
        <span style={{
          fontSize: 10.5,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          {provider.defaultModel || '—'}
        </span>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {provider.hasVaultKey ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-ok)', fontSize: 11, fontFamily: 'var(--font-ui)', marginLeft: 4 }}>
              <Shield size={11} strokeWidth={1.5} />
              Key cifrada
            </span>
          ) : provider.apiKey ? (
            revealed ? provider.apiKey : maskKey(provider.apiKey)
          ) : provider.kind === 'cloud' && (
            <span style={{ color: 'var(--status-err)', fontSize: 11, fontFamily: 'var(--font-ui)', marginLeft: 4 }}>
              Sin API key
            </span>
          )}
        </span>
        {provider.apiKey && (
          <button
            onClick={() => setRevealed(!revealed)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
            }}
          >
            {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
        <button
          onClick={onEdit}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
          }}
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => setConfirmDeleteOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
          }}
          title="Eliminar"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        itemLabel={getVendorLabel(provider.vendor)}
        onConfirm={async () => {
          removeProvider(provider.id)
          if (provider.hasVaultKey) {
            await removeFromVault(provider.id)
          }
        }}
      />

      <div style={{
        fontSize: 10.5,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
      }}>
        {t('models.added')}: {new Date(provider.createdAt).toLocaleDateString()} · {t('models.consumption')}: {t('models.noData')}
      </div>
    </div>
  )
}
