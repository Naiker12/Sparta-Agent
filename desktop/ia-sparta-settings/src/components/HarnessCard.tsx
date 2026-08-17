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
    color: 'var(--accent)',
    accentBg: 'var(--accent-muted)',
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
        justifyContent: 'space-between',
        padding: '16px 18px',
        borderRadius: 14,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-normal)',
        borderLeft: harness.installed ? `4px solid ${meta.color}` : '1px solid var(--border-normal)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        transition: 'all 0.18s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = harness.installed ? meta.color : 'var(--border-strong)'
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = harness.installed ? meta.color : 'var(--border-normal)'
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)'
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: harness.installed ? meta.accentBg : 'var(--bg-input)',
              border: `1px solid ${harness.installed ? meta.color : 'var(--border-subtle)'}`,
              color: harness.installed ? meta.color : 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <BrandIcon vendor={meta.vendor} size={20} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {harness.label}
              </span>

              {harness.installed ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: '#16a34a',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  <Check size={11} strokeWidth={2.5} /> Detectado
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 500,
                    background: 'var(--bg-hover)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  <X size={11} /> No instalado
                </span>
              )}
            </div>

            <p
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginTop: 4,
                marginBottom: 0,
                lineHeight: 1.45,
                fontFamily: 'var(--font-ui)',
              }}
            >
              {harness.description}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ flexShrink: 0 }}>
          {harness.installed ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 8,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <ShieldCheck size={13} color="#16a34a" />
              <span>{meta.commandHint}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={handleCopyInstall}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  transition: 'all 0.15s',
                }}
                title={`Copiar comando: ${meta.installCmd}`}
              >
                {copied ? <CheckCircle size={12} color="#16a34a" /> : <Copy size={12} />}
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
                    gap: 5,
                    padding: '5px 12px',
                    borderRadius: 8,
                    background: 'var(--accent)',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: 'none',
                    fontFamily: 'var(--font-ui)',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                >
                  <span>Guía</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Metadata Bar */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
        }}
      >
        {harness.installed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {harness.version || 'v1.0.0'}
            </span>
            <span>·</span>
            <span
              style={{
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                maxWidth: 400,
              }}
              title={harness.path || ''}
            >
              {harness.path}
            </span>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>
            Binario no encontrado en el PATH del sistema
          </span>
        )}

        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {harness.installed ? 'Listo para sesión' : 'Requiere instalación'}
        </span>
      </div>
    </div>
  )
}
