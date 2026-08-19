import { useState, useEffect } from 'react'
import {
  Copy,
  Check,
  ExternalLink,
  Download,
  Play,
  Heart,
  ArrowDown,
  Clock,
  Calendar,
  Cpu,
  Shield,
  FileCode,
  Users,
  BookOpen,
  ChevronDown,
  Terminal,
  HardDrive,
  Sparkles,
  RefreshCw,
  Globe,
} from 'lucide-react'
import { BrandIcon } from 'ia-sparta-design-system'
import { useTheme } from 'ia-sparta-core'
import type { ModelHubItem } from './types'
import { fetchHfModelInfo, type HfModelApiData } from './hfApi'

interface ModelDetailPanelProps {
  model: ModelHubItem | null
  onUseModel: (modelName: string) => void
  activeModelName?: string
}

export function ModelDetailPanel({ model, onUseModel, activeModelName }: ModelDetailPanelProps) {
  const { isDark } = useTheme()
  const [selectedQuantIndex, setSelectedQuantIndex] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [liveHfData, setLiveHfData] = useState<HfModelApiData | null>(null)
  const [isLoadingLive, setIsLoadingLive] = useState(false)

  // Consulta la API pública de Hugging Face / Unsloth en vivo al seleccionar el modelo
  useEffect(() => {
    if (!model || !model.name) {
      setLiveHfData(null)
      return
    }

    let isMounted = true
    setIsLoadingLive(true)

    fetchHfModelInfo(model.name)
      .then((data) => {
        if (isMounted) {
          setLiveHfData(data)
          setIsLoadingLive(false)
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingLive(false)
      })

    return () => {
      isMounted = false
    }
  }, [model?.name])

  if (!model) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: isDark ? '#64748B' : '#8A7D6F',
          padding: 40,
          textAlign: 'center',
          backgroundColor: isDark ? '#0D0F14' : '#F7F4EE',
        }}
      >
        <Sparkles size={36} color={isDark ? '#334155' : '#D5CCA'} style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#94A3B8' : '#2A241E', margin: '0 0 6px' }}>
          Selecciona un Modelo
        </h3>
        <p style={{ fontSize: 12, color: isDark ? '#475569' : '#786C5E', maxWidth: 360, margin: 0 }}>
          Explora los modelos cuantizados de la comunidad o examina los pesos locales descargados en tu equipo.
        </p>
      </div>
    )
  }

  // Quants combinados: locales o remotos detectados por la API
  const quants = (liveHfData?.quants && liveHfData.quants.length > 0)
    ? liveHfData.quants
    : (model.quants && model.quants.length > 0)
      ? model.quants
      : [{ name: `${model.format} Standard`, size: model.size, format: model.format }]

  const isActiveInChat = activeModelName === model.name || activeModelName === model.displayName

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Estilos temáticos
  const panelBg = isDark ? '#0D0F14' : '#FAF8F5'
  const cardBg = isDark ? '#131722' : '#FFFFFF'
  const cardBorder = isDark ? '#202736' : '#EAE3D8'
  const textPrimary = isDark ? '#FFFFFF' : '#1C1713'
  const textSecondary = isDark ? '#94A3B8' : '#786C5E'
  const borderDivider = isDark ? '#1C222E' : '#F0ECE4'

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: panelBg,
        overflowY: 'auto',
        padding: '24px 32px',
        color: isDark ? '#E2E8F0' : '#2A241E',
        fontFamily: 'var(--font-ui, system-ui, -apple-system, sans-serif)',
      }}
    >
      {/* 1. Header: Avatar + Title + Actions + Author */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              backgroundColor: isDark ? '#161B26' : '#FFFFFF',
              border: `1px solid ${cardBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.03)',
            }}
          >
            <BrandIcon vendor={model.vendor || 'unsloth'} size={32} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: textPrimary,
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {model.displayName}
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  title="Copiar identificador del modelo"
                  onClick={() => handleCopy(model.name, 'title')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isDark ? '#64748B' : '#8A7D6F',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {copiedId === 'title' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                </button>

                {model.huggingFaceUrl && (
                  <a
                    href={model.huggingFaceUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Ver en Hugging Face"
                    style={{
                      color: isDark ? '#64748B' : '#8A7D6F',
                      display: 'flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                      padding: 4,
                    }}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}

                {isLoadingLive && (
                  <span title="Consultando Hugging Face API en vivo...">
                    <RefreshCw size={12} className="animate-spin" color="#10B981" />
                  </span>
                )}
              </div>
            </div>

            {/* Author line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 13, color: textSecondary }}>
                {liveHfData?.author || model.author}
              </span>
              {model.authorVerified && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                  }}
                >
                  <Check size={9} strokeWidth={3.5} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Badges / Tags Strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        {model.tags && model.tags.map((tag, idx) => {
          const isPurple = tag.toLowerCase().includes('conversational') || tag.toLowerCase().includes('creative')
          return (
            <span
              key={idx}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 999,
                backgroundColor: isPurple
                  ? (isDark ? 'rgba(168, 85, 247, 0.15)' : '#F3E8FF')
                  : (isDark ? '#181D26' : '#F5EFE6'),
                border: isPurple
                  ? `1px solid ${isDark ? 'rgba(168, 85, 247, 0.35)' : '#E9D5FF'}`
                  : `1px solid ${isDark ? '#28303F' : '#EAE3D8'}`,
                color: isPurple ? (isDark ? '#C084FC' : '#6B21A8') : (isDark ? '#94A3B8' : '#5C5245'),
              }}
            >
              {tag}
            </span>
          )
        })}
      </div>

      {/* 3. Quantization Selection & Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 20,
          padding: '12px 14px',
          backgroundColor: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 12,
          flexWrap: 'wrap',
          boxShadow: isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.02)',
        }}
      >
        {/* Quant Dropdown */}
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <select
            value={selectedQuantIndex}
            onChange={(e) => setSelectedQuantIndex(Number(e.target.value))}
            style={{
              width: '100%',
              backgroundColor: isDark ? '#181D2A' : '#FAF8F5',
              border: `1px solid ${isDark ? '#2A3347' : '#DED7CB'}`,
              borderRadius: 8,
              padding: '9px 36px 9px 12px',
              fontSize: 12.5,
              fontWeight: 600,
              color: textPrimary,
              fontFamily: 'monospace',
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {quants.map((q, idx) => (
              <option key={idx} value={idx}>
                {q.name} ({q.size})
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            color={isDark ? '#64748B' : '#8A7D6F'}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Download button */}
          {model.downloadCommand && (
            <button
              type="button"
              onClick={() => handleCopy(model.downloadCommand!, 'download_cli')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 8,
                backgroundColor: isDark ? '#1E2535' : '#FFFFFF',
                border: `1px solid ${isDark ? '#2E384D' : '#DED7CB'}`,
                color: isDark ? '#E2E8F0' : '#2A241E',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              {copiedId === 'download_cli' ? <Check size={13} color="#10B981" /> : <Download size={13} />}
              <span>{copiedId === 'download_cli' ? 'Comando Copiado' : 'Download GGUF'}</span>
            </button>
          )}

          {/* Activate in Sparta */}
          <button
            type="button"
            onClick={() => onUseModel(model.name)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 18px',
              borderRadius: 8,
              backgroundColor: isActiveInChat ? (isDark ? '#064E3B' : '#DCFCE7') : '#10B981',
              border: isActiveInChat && !isDark ? '1px solid #10B981' : 'none',
              color: isActiveInChat ? (isDark ? '#FFFFFF' : '#166534') : '#FFFFFF',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
              transition: 'opacity 0.15s ease',
            }}
          >
            {isActiveInChat ? <Check size={13} strokeWidth={3} /> : <Play size={12} fill="#FFFFFF" />}
            <span>{isActiveInChat ? 'Activo en Chat' : 'Usar Modelo en Sparta'}</span>
          </button>
        </div>
      </div>

      {/* 4. Metadata Strip (Enhanced with Live Hugging Face API data) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginTop: 18,
          padding: '10px 0',
          borderBottom: `1px solid ${borderDivider}`,
          fontSize: 11.5,
          color: textSecondary,
        }}
      >
        {model.updatedAt && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clock size={13} color={isDark ? '#64748B' : '#8A7D6F'} />
            <span>{liveHfData?.lastModified ? new Date(liveHfData.lastModified).toLocaleDateString() : model.updatedAt}</span>
          </span>
        )}

        {model.releaseDate && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Calendar size={13} color={isDark ? '#64748B' : '#8A7D6F'} />
            <span>{model.releaseDate}</span>
          </span>
        )}

        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <ArrowDown size={13} color={isDark ? '#64748B' : '#8A7D6F'} />
          <span>{liveHfData?.downloads ? `${(liveHfData.downloads / 1000).toFixed(1)}k live` : model.downloads}</span>
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Heart size={13} color={isDark ? '#64748B' : '#8A7D6F'} />
          <span>{liveHfData?.likes !== undefined ? liveHfData.likes : model.likes}</span>
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Cpu size={13} color={isDark ? '#64748B' : '#8A7D6F'} />
          <span>{model.params}</span>
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Shield size={13} color={isDark ? '#64748B' : '#8A7D6F'} />
          <span>VRAM: {model.vramReqQ4}</span>
        </span>

        {model.license && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <FileCode size={13} color={isDark ? '#64748B' : '#8A7D6F'} />
            <span style={{ textTransform: 'uppercase' }}>{model.license}</span>
          </span>
        )}
      </div>

      {/* 5. Guide / Unsloth Dynamic Section */}
      <div style={{ marginTop: 22 }}>
        {model.guideTitle && (
          <h4
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: isDark ? '#34D399' : '#059669',
              margin: '0 0 4px',
              cursor: 'pointer',
            }}
          >
            {model.guideTitle}
          </h4>
        )}

        {model.guideNote && (
          <p
            style={{
              fontSize: 12.5,
              fontStyle: 'italic',
              color: isDark ? '#10B981' : '#15803D',
              margin: '0 0 16px',
            }}
          >
            {model.guideNote}
          </p>
        )}

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 20,
              backgroundColor: isDark ? '#1E2535' : '#FFFFFF',
              border: `1px solid ${isDark ? '#2B3549' : '#DED7CB'}`,
              color: textPrimary,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <BrandIcon vendor="unsloth" size={14} />
            <span>unsloth</span>
          </button>

          <a
            href="https://discord.gg/unsloth"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 20,
              backgroundColor: isDark ? '#1E2535' : '#FFFFFF',
              border: `1px solid ${isDark ? '#2B3549' : '#DED7CB'}`,
              color: isDark ? '#E2E8F0' : '#423A31',
              fontSize: 11.5,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <Users size={13} color={isDark ? '#94A3B8' : '#8A7D6F'} />
            <span>Join Community</span>
          </a>

          <a
            href="https://docs.unsloth.ai"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 20,
              backgroundColor: isDark ? '#1E2535' : '#FFFFFF',
              border: `1px solid ${isDark ? '#2B3549' : '#DED7CB'}`,
              color: isDark ? '#E2E8F0' : '#423A31',
              fontSize: 11.5,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <BookOpen size={13} color={isDark ? '#94A3B8' : '#8A7D6F'} />
            <span>Documentation</span>
          </a>
        </div>

        {/* Bullet Points */}
        {model.bulletPoints && (
          <ul
            style={{
              fontSize: 12.5,
              color: isDark ? '#CBD5E1' : '#423A31',
              lineHeight: 1.6,
              margin: '0 0 24px',
              paddingLeft: 18,
            }}
          >
            {model.bulletPoints.map((bp, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {bp}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 6. Brand Hero Banner Graphic */}
      <div
        style={{
          borderRadius: 14,
          backgroundColor: isDark ? '#11151E' : '#FAF8F5',
          border: `1px solid ${cardBorder}`,
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          margin: '8px 0 24px',
        }}
      >
        <div style={{ transform: 'scale(1.3)', marginBottom: 6 }}>
          <BrandIcon vendor={model.vendor || 'unsloth'} size={48} />
        </div>
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: textPrimary,
            letterSpacing: '-0.03em',
            textTransform: 'lowercase',
          }}
        >
          {model.vendor === 'meta' ? 'llama 3.3' : model.vendor || 'unsloth'}
        </span>
      </div>

      {/* 7. Local In-Disk Commands */}
      <div
        style={{
          backgroundColor: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 12,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Terminal size={14} color="#38BDF8" />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: textPrimary, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'monospace' }}>
              EJECUCIÓN LOCAL & CONEXIÓN D:\UNSLOTH-MAIN
            </span>
          </div>

          {model.localPath && (
            <span style={{ fontSize: 10.5, color: isDark ? '#34D399' : '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <HardDrive size={12} /> Pesos listos en disco
            </span>
          )}
        </div>

        {model.ollamaCommand && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: isDark ? '#161B26' : '#FAF8F5', border: `1px solid ${cardBorder}`, borderRadius: 8 }}>
            <code style={{ fontSize: 11.5, fontFamily: 'monospace', color: '#0284C7' }}>
              {model.ollamaCommand}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(model.ollamaCommand!, 'cmd_ollama')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 5,
                border: `1px solid ${isDark ? '#2A3347' : '#DED7CB'}`,
                backgroundColor: isDark ? '#1E2535' : '#FFFFFF',
                color: isDark ? '#E2E8F0' : '#2A241E',
                fontSize: 10.5,
                cursor: 'pointer',
              }}
            >
              {copiedId === 'cmd_ollama' ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
              <span>{copiedId === 'cmd_ollama' ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        )}

        {model.vllmCommand && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: isDark ? '#161B26' : '#FAF8F5', border: `1px solid ${cardBorder}`, borderRadius: 8 }}>
            <code style={{ fontSize: 11.5, fontFamily: 'monospace', color: '#D97706' }}>
              {model.vllmCommand}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(model.vllmCommand!, 'cmd_vllm')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 5,
                border: `1px solid ${isDark ? '#2A3347' : '#DED7CB'}`,
                backgroundColor: isDark ? '#1E2535' : '#FFFFFF',
                color: isDark ? '#E2E8F0' : '#2A241E',
                fontSize: 10.5,
                cursor: 'pointer',
              }}
            >
              {copiedId === 'cmd_vllm' ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
              <span>{copiedId === 'cmd_vllm' ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 8. Footer External Links */}
      {model.externalLinks && model.externalLinks.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 24, paddingTop: 14, borderTop: `1px solid ${borderDivider}` }}>
          {model.externalLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 6,
                backgroundColor: isDark ? '#141822' : '#FFFFFF',
                border: `1px solid ${cardBorder}`,
                color: textSecondary,
                fontSize: 11.5,
                textDecoration: 'none',
              }}
            >
              <Globe size={11} />
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
