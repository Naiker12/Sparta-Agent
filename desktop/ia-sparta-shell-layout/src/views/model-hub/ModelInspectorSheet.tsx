import { useState } from 'react'
import { X, Cpu, ShieldCheck, Copy, Check, ExternalLink, HardDrive, Terminal, Download } from 'lucide-react'
import { BrandIcon } from 'ia-sparta-design-system'
import type { ModelHubItem } from './types'

interface ModelInspectorSheetProps {
  model: ModelHubItem | null
  onClose: () => void
  onSelect: (modelName: string) => void
}

export function ModelInspectorSheet({ model, onClose, onSelect }: ModelInspectorSheetProps) {
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
        backgroundColor: 'rgba(0,0,0,0.32)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid #EAE3D8',
          width: '100%',
          maxWidth: 480,
          height: '100%',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          animation: 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid #F0ECE4',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            backgroundColor: '#FAF8F5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
                border: '1px solid #EAE3D8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
              }}
            >
              <BrandIcon vendor={model.vendor || 'unsloth'} size={28} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1C1713', margin: 0, lineHeight: 1.2 }}>
                  {model.displayName}
                </h3>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '1.5px 6px',
                    borderRadius: 4,
                    backgroundColor: model.isLocalAvailable ? '#DCFCE7' : '#F5EFE6',
                    color: model.isLocalAvailable ? '#166534' : '#5C5245',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {model.isLocalAvailable ? 'LOCAL' : model.format}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#8A7D6F', display: 'block', marginTop: 2 }}>
                {model.name}
              </span>
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
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          {/* Overview Description */}
          <div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
              DESCRIPCIÓN DEL MODELO
            </span>
            <p style={{ fontSize: 12, color: '#423A31', lineHeight: 1.5, margin: '6px 0 0 0' }}>
              {model.description}
            </p>
          </div>

          {/* Hardware & VRAM Telemetry Card */}
          <div
            style={{
              backgroundColor: '#FAF8F5',
              border: '1px solid #EAE3D8',
              borderRadius: 14,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Cpu size={14} color="#8A7D6F" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1C1713', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
                  REQUISITOS DE VRAM & HARDWARE
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '9px 12px', borderRadius: 8, border: '1px solid #EAE3D8' }}>
                <span style={{ fontSize: 10, color: '#8A7D6F', display: 'block' }}>VRAM Mínima (Q4_K_M):</span>
                <strong style={{ fontSize: 13, color: '#1C1713', fontFamily: 'var(--font-mono, monospace)' }}>
                  {model.vramReqQ4}
                </strong>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '9px 12px', borderRadius: 8, border: '1px solid #EAE3D8' }}>
                <span style={{ fontSize: 10, color: '#8A7D6F', display: 'block' }}>VRAM Alta Precisión (Q8_0):</span>
                <strong style={{ fontSize: 13, color: '#1C1713', fontFamily: 'var(--font-mono, monospace)' }}>
                  {model.vramReqQ8}
                </strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: '#5C5245' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '6px 10px', borderRadius: 8, border: '1px solid #EAE3D8' }}>
                <span>Parámetros: </span>
                <strong style={{ color: '#1C1713', fontFamily: 'var(--font-mono, monospace)' }}>{model.params}</strong>
              </div>
              <div style={{ backgroundColor: '#FFFFFF', padding: '6px 10px', borderRadius: 8, border: '1px solid #EAE3D8' }}>
                <span>Contexto: </span>
                <strong style={{ color: '#1C1713', fontFamily: 'var(--font-mono, monospace)' }}>{model.contextWindow}</strong>
              </div>
            </div>

            {model.localPath && (
              <div style={{ fontSize: 11, color: '#5C5245', backgroundColor: '#FFFFFF', padding: '8px 12px', borderRadius: 8, border: '1px solid #EAE3D8', wordBreak: 'break-all' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <HardDrive size={12} color="#8A7D6F" />
                  <strong style={{ fontSize: 10.5, color: '#1C1713' }}>Ruta de Pesos en Disco:</strong>
                </div>
                <code style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10.5, color: '#2A241E' }}>
                  {model.localPath}
                </code>
              </div>
            )}
          </div>

          {/* Capabilities Badges */}
          <div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
              CAPACIDADES Y ESPECIALIZACIÓN
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {model.capabilities.reasoning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 6, backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontSize: 11, fontWeight: 600 }}>
                  <span>🧠 Razonamiento Profundo (Chain-of-Thought)</span>
                </div>
              )}
              {model.capabilities.code && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 6, backgroundColor: '#E0F2FE', border: '1px solid #BAE6FD', color: '#0369A1', fontSize: 11, fontWeight: 600 }}>
                  <span>💻 Refactorización y Generación de Código</span>
                </div>
              )}
              {model.capabilities.tools && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 6, backgroundColor: '#F3E8FF', border: '1px solid #E9D5FF', color: '#6B21A8', fontSize: 11, fontWeight: 600 }}>
                  <span>🛠️ Llamadas a Herramientas (Tool Calling)</span>
                </div>
              )}
            </div>
          </div>

          {/* Direct Execution Commands */}
          {(model.ollamaCommand || model.vllmCommand) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Terminal size={13} color="#8A7D6F" />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
                  COMANDOS DE EJECUCIÓN DIRECTA
                </span>
              </div>

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

              {model.downloadCommand && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Download size={13} color="#8A7D6F" />
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
                      DESCARGAR EN D:\UNSLOTH-MAIN (HUGGING FACE CLI)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#FAF8F5', border: '1px solid #EAE3D8', borderRadius: 8 }}>
                    <code style={{ fontSize: 10.5, fontFamily: 'var(--font-mono, monospace)', color: '#1C1713', wordBreak: 'break-all' }}>
                      {model.downloadCommand}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(model.downloadCommand!, 'download')}
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
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    >
                      {copiedCmd === 'download' ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                      <span>{copiedCmd === 'download' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Footer Action Bar */}
        <div
          style={{
            padding: '14px 22px',
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
                padding: '7px 14px',
                borderRadius: 8,
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
                padding: '7px 16px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: '#10B981',
                color: '#FFFFFF',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)',
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
