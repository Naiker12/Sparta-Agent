import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Terminal, Sparkles } from 'lucide-react'
import { HarnessCard } from '../components/HarnessCard'
import { HarnessHistoryList } from '../components/HarnessHistoryList'
import type { HarnessStatus } from 'ia-sparta-ipc-bridge'
import { useHarnessHistoryStore } from 'ia-sparta-core'

export function HarnessesTab() {
  const [statuses, setStatuses] = useState<HarnessStatus[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const addEntry = useHarnessHistoryStore((s) => s.addEntry)

  const scan = useCallback(async () => {
    setScanning(true)
    try {
      if (typeof window !== 'undefined' && window.sparta?.harnesses?.detect) {
        const result = (await window.sparta.harnesses.detect()) as HarnessStatus[]
        setStatuses(result)
        result.forEach((h) => {
          if (h.installed) {
            addEntry({
              harnessId: h.id,
              action: 'detected',
              detail: h.version ?? 'instalado',
            })
          }
        })
      } else {
        setStatuses([])
      }
    } catch {
      setStatuses([])
    } finally {
      setScanning(false)
    }
  }, [addEntry])

  useEffect(() => {
    scan()
  }, [scan])

  const installedCount = statuses?.filter((s) => s.installed).length ?? 0
  const totalCount = statuses?.length ?? 4

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '4px 0 16px',
        maxWidth: 820,
        width: '100%',
        fontFamily: 'var(--font-ui, system-ui, -apple-system, sans-serif)',
      }}
    >
      {/* 1. Header principal técnico superior */}
      <div>
        <h2
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: '#2A241E',
            margin: '0 0 2px 0',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          SPARTA — HERRAMIENTAS IA Y ASISTENTES CLI
        </h2>
        <p
          style={{
            fontSize: 11.5,
            color: '#786C5E',
            margin: 0,
            lineHeight: 1.35,
          }}
        >
          Detecta y conecta automáticamente CLIs como Claude Code, OpenCode, Gemini CLI y Codex para streaming en vivo.
        </p>
      </div>

      {/* 2. Tarjeta Contenedora Principal */}
      <div
        style={{
          backgroundColor: '#FAF8F5',
          border: '1px solid #EAE3D8',
          borderRadius: 14,
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        }}
      >
        {/* Card Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#F5EFE6',
                border: '1px solid #E6DFD5',
                color: '#B45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Terminal size={16} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3
                  style={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#1C1713',
                    margin: 0,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  ASISTENTES Y RUNTIMES DETECTADOS
                </h3>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '1.5px 7px',
                    borderRadius: 999,
                    backgroundColor: installedCount > 0 ? '#DCFCE7' : '#F5EFE6',
                    color: installedCount > 0 ? '#166534' : '#786C5E',
                    border: `1px solid ${installedCount > 0 ? '#86EFAC' : '#E6DFD5'}`,
                  }}
                >
                  {installedCount}/{totalCount} activos
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#8A7D6F', margin: '2px 0 0 0' }}>
                Harneses de terminal ejecutables en el PATH de tu sistema local.
              </p>
            </div>
          </div>

          <button
            onClick={scan}
            disabled={scanning}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 12px',
              borderRadius: 8,
              backgroundColor: '#FFFFFF',
              border: '1px solid #DED7CB',
              color: '#423A31',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: scanning ? 'default' : 'pointer',
              opacity: scanning ? 0.7 : 1,
              transition: 'all 0.12s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { if (!scanning) e.currentTarget.style.backgroundColor = '#EFEAE1' }}
            onMouseLeave={(e) => { if (!scanning) e.currentTarget.style.backgroundColor = '#FFFFFF' }}
          >
            <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} />
            <span>{scanning ? 'Escaneando...' : 'Re-escanear'}</span>
          </button>
        </div>

        {/* Cards List Compact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {statuses?.map((h) => (
            <HarnessCard key={h.id} harness={h} />
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #EAE3D8',
            paddingTop: 8,
            marginTop: 2,
          }}
        >
          <span style={{ fontSize: 10.5, color: '#8A7D6F', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={11} color="#B45309" />
            Integración nativa con canales de terminal Sparta IPC
          </span>
        </div>
      </div>

      {/* History log */}
      <HarnessHistoryList />
    </div>
  )
}
