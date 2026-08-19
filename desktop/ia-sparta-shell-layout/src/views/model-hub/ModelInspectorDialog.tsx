import { useState } from 'react'
import { X, Cpu, ShieldCheck, Copy, Check, ExternalLink } from 'lucide-react'
import { BrandIcon } from 'ia-sparta-design-system'
import type { ModelHubItem } from './types'

interface ModelInspectorDialogProps {
  model: ModelHubItem | null
  onClose: () => void
  onSelect: (modelName: string) => void
}

export function ModelInspectorDialog({ model, onClose, onSelect }: ModelInspectorDialogProps) {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  if (!model) return null

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedCmd(id)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #EAE3D8',
          borderRadius: 20,
          maxWidth: 580,
          width: '100%',
          boxShadow: '0 25px 60px -12px rgba(40,25,10,0.25)',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          animation: 'modalScaleIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #F0ECE4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FAF8F5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandIcon vendor={model.isLocalAvailable ? 'unsloth' : 'huggingface'} size={22} />
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1C1713', margin: 0 }}>
                {model.displayName}
              </h3>
              <span style={{ fontSize: 11, color: '#8A7D6F' }}>{model.name}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#8A7D6F',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
          
          {/* Description */}
          <p style={{ fontSize: 12, color: '#423A31', lineHeight: 1.5, margin: 0 }}>
            {model.description}
          </p>

          {/* VRAM & Hardware Requirements */}
          <div
            style={{
              backgroundColor: '#FAF8F5',
              border: '1px solid #EAE3D8',
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Cpu size={14} color="#8A7D6F" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1C1713', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
                  REQUISITOS DE HARDWARE & VRAM
                </span>
              </div>

              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <ShieldCheck size={13} color="#16A34A" /> Apto para tu PC
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '8px 10px', borderRadius: 8, border: '1px solid #EAE3D8' }}>
                <span style={{ fontSize: 10, color: '#8A7D6F', display: 'block' }}>VRAM Mínima (Q4_K_M):</span>
                <strong style={{ fontSize: 13, color: '#1C1713', fontFamily: 'var(--font-mono, monospace)' }}>
                  {model.vramReqQ4}
                </strong>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '8px 10px', borderRadius: 8, border: '1px solid #EAE3D8' }}>
                <span style={{ fontSize: 10, color: '#8A7D6F', display: 'block' }}>VRAM Alta Precisión (Q8_0):</span>
                <strong style={{ fontSize: 13, color: '#1C1713', fontFamily: 'var(--font-mono, monospace)' }}>
                  {model.vramReqQ8}
                </strong>
              </div>
            </div>

            {model.localPath && (
              <div style={{ fontSize: 11, color: '#5C5245', backgroundColor: '#FFFFFF', padding: '6px 10px', borderRadius: 8, border: '1px solid #EAE3D8', wordBreak: 'break-all' }}>
                <span style={{ fontWeight: 600, color: '#1C1713' }}>Ruta de Pesos en tu Disco: </span>
                <code style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10.5 }}>{model.localPath}</code>
              </div>
            )}
          </div>

          {/* Execution Commands */}
          {(model.ollamaCommand || model.vllmCommand) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
                COMANDOS DE EJECUCIÓN DIRECTA
              </span>

              {model.ollamaCommand && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#FAF8F5', border: '1px solid #EAE3D8', borderRadius: 8 }}>
                  <code style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: '#1C1713' }}>
                    {model.ollamaCommand}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(model.ollamaCommand!, 'ollama')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid #DED7CB',
                      backgroundColor: '#FFFFFF',
                      color: '#2A241E',
                      fontSize: 10.5,
                      cursor: 'pointer',
                    }}
                  >
                    {copiedCmd === 'ollama' ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                    <span>{copiedCmd === 'ollama' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              )}

              {model.vllmCommand && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#FAF8F5', border: '1px solid #EAE3D8', borderRadius: 8 }}>
                  <code style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: '#1C1713' }}>
                    {model.vllmCommand}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(model.vllmCommand!, 'vllm')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid #DED7CB',
                      backgroundColor: '#FFFFFF',
                      color: '#2A241E',
                      fontSize: 10.5,
                      cursor: 'pointer',
                    }}
                  >
                    {copiedCmd === 'vllm' ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                    <span>{copiedCmd === 'vllm' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #F0ECE4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FAF8F5',
          }}
        >
          {model.huggingFaceUrl ? (
            <a
              href={model.huggingFaceUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                color: '#8A7D6F',
                fontSize: 11,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={12} />
              <span>Ver en Hugging Face ↗</span>
            </a>
          ) : <div />}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 12px',
                borderRadius: 7,
                border: '1px solid #DED7CB',
                backgroundColor: '#FFFFFF',
                color: '#423A31',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={() => {
                onSelect(model.name)
                onClose()
              }}
              style={{
                padding: '6px 16px',
                borderRadius: 7,
                border: 'none',
                backgroundColor: '#10B981',
                color: '#FFFFFF',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Usar Modelo en Sparta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
