import { useState } from 'react'
import { Check, X, ExternalLink, Copy, CheckCircle, ShieldCheck } from 'lucide-react'
import type { HarnessStatus } from 'ia-sparta-ipc-bridge'
import { BrandIcon } from 'ia-sparta-design-system'

const HARNESS_METADATA: Record<
  string,
  {
    vendor: string
    color: string
    accentBg: string
    commandHint: string
    installCmd: string
  }
> = {
  'claude-code': {
    vendor: 'claude',
    color: '#D97736',
    accentBg: 'rgba(217, 119, 54, 0.1)',
    commandHint: 'claude',
    installCmd: 'npm install -g @anthropic-ai/claude-code',
  },
  opencode: {
    vendor: 'opencode',
    color: '#0EA5E9',
    accentBg: 'rgba(14, 165, 233, 0.1)',
    commandHint: 'opencode',
    installCmd: 'npm install -g opencode-ai',
  },
  'gemini-cli': {
    vendor: 'gemini',
    color: '#8B5CF6',
    accentBg: 'rgba(139, 92, 246, 0.1)',
    commandHint: 'gemini',
    installCmd: 'npm install -g @google/gemini-cli',
  },
  'codex-cli': {
    vendor: 'openai',
    color: '#10B981',
    accentBg: 'rgba(16, 185, 129, 0.1)',
    commandHint: 'codex',
    installCmd: 'npm install -g openai-codex-cli',
  },
}

export function HarnessCard({ harness }: { harness: HarnessStatus }) {
  const [copied, setCopied] = useState(false)
  const meta = HARNESS_METADATA[harness.id] ?? {
    vendor: 'filesystem',
    color: '#B45309',
    accentBg: '#F5EFE6',
    commandHint: harness.id,
    installCmd: `npm install -g ${harness.id}`,
  }

  function handleCopyInstall(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(meta.installCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        border: '1px solid #EAE3D8',
        borderLeft: harness.installed ? `3px solid ${meta.color}` : '1px solid #EAE3D8',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = harness.installed ? meta.color : '#DED6CA'
        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.03)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = harness.installed ? meta.color : '#EAE3D8'
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)'
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 240, flex: 1 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F5EFE6',
              border: '1px solid #E6DFD5',
              flexShrink: 0,
            }}
          >
            <BrandIcon vendor={meta.vendor} size={18} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#2A241E',
                  letterSpacing: '-0.01em',
                }}
              >
                {harness.label}
              </span>

              {harness.installed ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '1px 6px',
                    borderRadius: 999,
                    fontSize: 9.5,
                    fontWeight: 700,
                    backgroundColor: '#DCFCE7',
                    color: '#166534',
                    border: '1px solid #86EFAC',
                  }}
                >
                  <Check size={10} strokeWidth={2.5} /> Detectado
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '1px 6px',
                    borderRadius: 999,
                    fontSize: 9.5,
                    fontWeight: 600,
                    backgroundColor: '#F5EFE6',
                    color: '#786C5E',
                    border: '1px solid #E6DFD5',
                  }}
                >
                  <X size={10} /> No instalado
                </span>
              )}
            </div>

            <p
              style={{
                fontSize: 11,
                color: '#786C5E',
                margin: '2px 0 0 0',
                lineHeight: 1.35,
              }}
            >
              {harness.description}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {harness.installed ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                backgroundColor: '#FAF8F5',
                border: '1px solid #DED7CB',
                fontSize: 10.5,
                fontWeight: 600,
                color: '#423A31',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              <ShieldCheck size={12} color="#16A34A" />
              <span>{meta.commandHint}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={handleCopyInstall}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 9px',
                  borderRadius: 6,
                  backgroundColor: '#FAF8F5',
                  border: '1px solid #DED7CB',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#423A31',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EFEAE1' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FAF8F5' }}
                title={`Copiar comando: ${meta.installCmd}`}
              >
                {copied ? <CheckCircle size={11} color="#16a34a" /> : <Copy size={11} />}
                <span>{copied ? 'Copiado' : 'Copiar npm'}</span>
              </button>

              {harness.docsUrl && (
                <a
                  href={harness.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 6,
                    backgroundColor: '#B45309',
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'background 0.12s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#92400E' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#B45309' }}
                >
                  <span>Guía</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Metadata Bar */}
      <div
        style={{
          paddingTop: 6,
          borderTop: '1px solid #F0ECE4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 10,
          fontFamily: 'var(--font-mono, monospace)',
          color: '#8A7D6F',
        }}
      >
        {harness.installed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
            <span style={{ color: '#2A241E', fontWeight: 600 }}>
              {harness.version || 'v1.0.0'}
            </span>
            <span>·</span>
            <span
              style={{
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                maxWidth: 360,
              }}
              title={harness.path || ''}
            >
              {harness.path}
            </span>
          </div>
        ) : (
          <span>Binario no encontrado en el PATH del sistema</span>
        )}

        <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: harness.installed ? '#16A34A' : '#A89F91' }}>
          {harness.installed ? 'LISTO PARA SESIÓN' : 'REQUIERE INSTALACIÓN'}
        </span>
      </div>
    </div>
  )
}
