import type { ProviderVendor } from '@/types'
import { getVendorLabel } from '@/stores/provider.store'
import { useTranslation } from '@/i18n'
import { BrandIcon } from '@/components/ui/BrandIcon'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/modal'

interface ChooseProviderDialogProps {
  open: boolean
  onSelect: (vendor: ProviderVendor) => void
  onClose: () => void
}

const CLOUD_VENDORS: ProviderVendor[] = ['anthropic', 'openai', 'google', 'groq', 'mistral', 'azure', 'deepseek', 'together', 'fireworks', 'openrouter', 'cohere', 'perplexity', 'xai']
const LOCAL_VENDORS: ProviderVendor[] = ['ollama', 'lmstudio', 'llamacpp', 'custom']

export function ChooseProviderDialog({ open, onSelect, onClose }: ChooseProviderDialogProps) {
  const { t } = useTranslation()

  function renderVendor(vendor: ProviderVendor) {
    return (
      <button
        key={vendor}
        type="button"
        onClick={() => onSelect(vendor)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          fontSize: 12.5,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <BrandIcon vendor={vendor} size={16} />
        {getVendorLabel(vendor)}
      </button>
    )
  }

  return (
    <Modal open={open} onClose={onClose} width={340} maxHeight={420}>
      <ModalHeader title={t('models.chooseTitle')} onClose={onClose} />
      <ModalBody style={{ padding: '0 16px' }}>
        <div style={{ paddingBottom: 12 }}>
          <div style={{ marginBottom: 6 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              marginBottom: 4,
              padding: '0 12px',
            }}>
              {t('models.cloud')}
            </div>
            {CLOUD_VENDORS.map(renderVendor)}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginBottom: 4 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              marginBottom: 4,
              padding: '0 12px',
            }}>
              {t('models.local')}
            </div>
            {LOCAL_VENDORS.map(renderVendor)}
          </div>
        </div>
      </ModalBody>
    </Modal>
  )
}
