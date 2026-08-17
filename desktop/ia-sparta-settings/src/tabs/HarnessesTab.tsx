import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Terminal } from 'lucide-react'
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
  const totalCount = statuses?.length ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-ui)' }}>
      {/* Top Banner / Status Overview */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderRadius: 14,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-normal)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-muted)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              flexShrink: 0,
            }}
          >
            <Terminal size={18} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Herramientas IA y Asistentes CLI
              </h2>
              {statuses && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 600,
                    background: installedCount > 0 ? 'rgba(34, 197, 94, 0.12)' : 'var(--bg-input)',
                    color: installedCount > 0 ? '#16a34a' : 'var(--text-muted)',
                    border: `1px solid ${installedCount > 0 ? 'rgba(34, 197, 94, 0.25)' : 'var(--border-subtle)'}`,
                  }}
                >
                  {installedCount}/{totalCount} activos
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Detecta y conecta automáticamente CLIs como Claude Code, OpenCode, Gemini CLI y Codex para streaming en vivo.
            </p>
          </div>
        </div>

        <button
          onClick={scan}
          disabled={scanning}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 8,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-normal)',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 500,
            cursor: scanning ? 'not-allowed' : 'pointer',
            opacity: scanning ? 0.7 : 1,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { if (!scanning) e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={(e) => { if (!scanning) e.currentTarget.style.background = 'var(--bg-input)' }}
        >
          <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
          <span>{scanning ? 'Escaneando...' : 'Re-escanear'}</span>
        </button>
      </div>

      {/* Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {statuses?.map((h) => (
          <HarnessCard key={h.id} harness={h} />
        ))}
      </div>

      {/* History log */}
      <HarnessHistoryList />
    </div>
  )
}
