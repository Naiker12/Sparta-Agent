import { useState, useEffect, useRef } from 'react'
import { Cpu, X, SlidersHorizontal, Laptop, Maximize2 } from 'lucide-react'
import { useTranslation } from 'ia-sparta-i18n'
import { SystemMonitorDialog } from './SystemMonitorDialog'

interface ProcessGroup {
  name: string
  cpu: number
  memoryMb: number
}

export function ResourceMonitorPopover() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [monitorDialogOpen, setMonitorDialogOpen] = useState(false)
  const [cpuPercent, setCpuPercent] = useState<number>(1.8)
  const [memoryMb, setMemoryMb] = useState<number>(577)
  const [ramSharePercent, setRamSharePercent] = useState<number>(3.5)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [open])

  const [processes, setProcesses] = useState<ProcessGroup[]>([
    { name: 'Main', cpu: 0.4, memoryMb: 126 },
    { name: 'Renderer', cpu: 0.9, memoryMb: 222 },
    { name: 'Other', cpu: 0.3, memoryMb: 229 },
  ])

  // Real process telemetry sampling from Electron Main
  useEffect(() => {
    if (!open && !monitorDialogOpen) return

    let cancelled = false

    async function fetchRealMetrics() {
      if (typeof window !== 'undefined' && window.electron?.invoke) {
        try {
          const data = (await window.electron.invoke('system:get-metrics')) as {
            cpuPercent: number
            memoryMb: number
            ramSharePercent: number
            processes: ProcessGroup[]
          }
          if (data && !cancelled) {
            setCpuPercent(data.cpuPercent ?? 1.8)
            setMemoryMb(data.memoryMb ?? 577)
            setRamSharePercent(data.ramSharePercent ?? 3.5)
            if (data.processes) setProcesses(data.processes)
          }
        } catch {
          /* ignore fallback */
        }
      }
    }

    fetchRealMetrics()
    const interval = setInterval(fetchRealMetrics, 2000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [open, monitorDialogOpen])

  return (
    <>
      <div ref={containerRef} style={{ position: 'relative' }} className="no-drag">
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: open ? 'var(--bg-active)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: open ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => {
            if (!open) {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }
          }}
          onMouseLeave={(e) => {
            if (!open) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }
          }}
          title={t('resources.tooltip') || 'Recursos y rendimiento'}
        >
          <Cpu size={14} />
        </button>

        {open && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 999,
              width: 380,
              background: 'var(--bg-modal, #FFFFFF)',
              border: '1px solid var(--border-strong, #EAE3D8)',
              borderRadius: 16,
              boxShadow: '0 20px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.04)',
              padding: 0,
              overflow: 'hidden',
              animation: 'modalScaleIn 0.12s ease-out',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-subtle, #F0ECE4)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #1C1713)' }}>
                {t('resources.title') || 'Recursos'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => {
                    setOpen(false)
                    setMonitorDialogOpen(true)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #8A7D6F)',
                    cursor: 'pointer',
                    padding: 3,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#B45309'
                    e.currentTarget.style.backgroundColor = '#F5EFE6'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted, #8A7D6F)'
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  title="Abrir vista completa con gráficas de rendimiento"
                >
                  <SlidersHorizontal size={13} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #8A7D6F)',
                    cursor: 'pointer',
                    padding: 3,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary, #1C1713)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8A7D6F)')}
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Top Metrics Cards */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle, #F0ECE4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', fontFamily: 'var(--font-mono, monospace)' }}>
                    {t('resources.cpu') || 'CPU'}
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #1C1713)', fontFamily: 'var(--font-mono, monospace)', marginTop: 2 }}>
                    {cpuPercent}%
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', fontFamily: 'var(--font-mono, monospace)' }}>
                    {t('resources.memory') || 'MEMORIA'}
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #1C1713)', fontFamily: 'var(--font-mono, monospace)', marginTop: 2 }}>
                    {memoryMb} MB
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', fontFamily: 'var(--font-mono, monospace)' }}>
                    {t('resources.ramShare') || 'USO DE RAM'}
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #1C1713)', fontFamily: 'var(--font-mono, monospace)', marginTop: 2 }}>
                    {ramSharePercent}%
                  </div>
                </div>
              </div>

              {/* RAM Progress Bar */}
              <div
                style={{
                  marginTop: 10,
                  width: '100%',
                  height: 4,
                  borderRadius: 999,
                  background: 'var(--bg-input, #F5EFE6)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(5, ramSharePercent * 4))}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #B45309 0%, #16A34A 100%)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {/* Desktop App Breakdown */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle, #F0ECE4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Laptop size={13} style={{ color: '#B45309' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #1C1713)' }}>
                    {t('resources.spartaDesktop') || 'Sparta Desktop'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: '#786C5E' }}>
                  <span>{cpuPercent}%</span>
                  <span>{memoryMb} MB</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 20 }}>
                {processes.map((proc) => (
                  <div
                    key={proc.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: 'var(--text-secondary, #5C5245)',
                    }}
                  >
                    <span>{proc.name}</span>
                    <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono, monospace)', fontSize: 10.5 }}>
                      <span style={{ width: 36, textAlign: 'right' }}>{proc.cpu}%</span>
                      <span style={{ width: 54, textAlign: 'right' }}>{proc.memoryMb} MB</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks & Process Trees */}
            <div style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, color: '#8A7D6F', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('resources.noActiveTasks') || 'Sin árboles de procesos de tareas activas.'}</span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setMonitorDialogOpen(true)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  color: '#B45309',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>Gráficas</span>
                <Maximize2 size={11} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Screen / Large System Monitor Dialog */}
      <SystemMonitorDialog
        open={monitorDialogOpen}
        onClose={() => setMonitorDialogOpen(false)}
        initialCpu={cpuPercent}
        initialMemory={memoryMb}
        initialRamShare={ramSharePercent}
      />
    </>
  )
}
