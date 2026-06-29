import { X } from 'lucide-react'
import type { ProviderVendor } from '@/types'
import { getVendorLabel } from '@/stores/provider.store'
import { useTranslation } from '@/i18n'
import { BrandIcon } from '@/components/ui/BrandIcon'

interface ChooseProviderDialogProps {
  open: boolean
  onSelect: (vendor: ProviderVendor) => void
  onClose: () => void
}

const CLOUD_VENDORS: ProviderVendor[] = ['anthropic', 'openai', 'google', 'groq', 'mistral', 'azure', 'deepseek', 'together', 'fireworks', 'openrouter', 'cohere', 'perplexity', 'xai']
const LOCAL_VENDORS: ProviderVendor[] = ['ollama', 'lmstudio', 'llamacpp', 'custom']

export function ChooseProviderDialog({ open, onSelect, onClose }: ChooseProviderDialogProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 340, maxWidth: '92vw', maxHeight: '85vh',
          background: 'var(--bg-modal)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 0', flexShrink: 0,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
            {t('models.chooseTitle')}
          </h3>
          <button onClick={onClose} style={{
            width: 24, height: 24, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px 16px',
        }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.07em', color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)', marginBottom: 4, padding: '0 12px',
            }}>
              {t('models.cloud')}
            </div>
            {CLOUD_VENDORS.map((vendor) => (
              <button
                key={vendor}
                type="button"
                onClick={() => onSelect(vendor)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  textAlign: 'left', padding: '8px 12px', background: 'none',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontSize: 12.5,
                  fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                <BrandIcon vendor={vendor} size={16} />
                {getVendorLabel(vendor)}
              </button>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.07em', color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)', marginBottom: 4, padding: '0 12px',
            }}>
              {t('models.local')}
            </div>
            {LOCAL_VENDORS.map((vendor) => (
              <button
                key={vendor}
                type="button"
                onClick={() => onSelect(vendor)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  textAlign: 'left', padding: '8px 12px', background: 'none',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontSize: 12.5,
                  fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                <BrandIcon vendor={vendor} size={16} />
                {getVendorLabel(vendor)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
