import { useState, useEffect, useRef } from 'react'
import { Cpu, X, SlidersHorizontal, Laptop } from 'lucide-react'
import { useTranslation } from 'ia-sparta-i18n'

interface ProcessGroup {
  name: string
  cpu: number
  memoryMb: number
}

export function ResourceMonitorPopover() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [cpuPercent, setCpuPercent] = useState<number>(4.7)
  const [memoryMb, setMemoryMb] = useState<number>(616)
  const [ramSharePercent, setRamSharePercent] = useState<number>(2.4)
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
    { name: 'Main', cpu: 1.5, memoryMb: 170 },
    { name: 'Renderer', cpu: 2.2, memoryMb: 231 },
    { name: 'Other', cpu: 1.0, memoryMb: 215 },
  ])

  // Live sampling simulation / performance API integration
  useEffect(() => {
    if (!open) return

    const interval = setInterval(() => {
      // Memory usage from performance API if available
      const perf = (performance as any).memory
      const baseMemory = perf?.usedJSHeapSize ? Math.round(perf.usedJSHeapSize / (1024 * 1024)) + 380 : 616

      // Small natural jitter simulation for CPU %
      const randomCpu = +(3.2 + Math.random() * 2.8).toFixed(1)
      const mainCpu = +(randomCpu * 0.35).toFixed(1)
      const renderCpu = +(randomCpu * 0.45).toFixed(1)
      const otherCpu = +(randomCpu - mainCpu - renderCpu).toFixed(1)

      setCpuPercent(randomCpu)
      setMemoryMb(baseMemory)
      setRamSharePercent(+((baseMemory / 16384) * 100).toFixed(1))

      setProcesses([
        { name: 'Main', cpu: mainCpu, memoryMb: Math.round(baseMemory * 0.28) },
        { name: 'Renderer', cpu: renderCpu, memoryMb: Math.round(baseMemory * 0.38) },
        { name: 'Other', cpu: Math.max(0.1, otherCpu), memoryMb: Math.round(baseMemory * 0.34) },
      ])
    }, 1500)

    return () => clearInterval(interval)
  }, [open])

  return (
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
        title={t('resources.tooltip')}
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
            background: 'var(--bg-modal)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
            padding: 0,
            overflow: 'hidden',
            animation: 'modalScaleIn 0.12s ease-out',
            fontFamily: 'var(--font-ui)',
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
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {t('resources.title')}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                title="Sorting / Process options"
              >
                <SlidersHorizontal size={13} />
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Top Metrics Cards */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('resources.cpu')}
                </span>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {cpuPercent}%
                </div>
              </div>

              <div>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('resources.memory')}
                </span>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {memoryMb} MB
                </div>
              </div>

              <div>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('resources.ramShare')}
                </span>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
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
                background: 'var(--bg-input)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(5, ramSharePercent * 4))}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, var(--accent) 0%, #22c55e 100%)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Desktop App Breakdown */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Laptop size={13} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t('resources.spartaDesktop')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
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
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>{proc.name}</span>
                  <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                    <span style={{ width: 36, textAlign: 'right' }}>{proc.cpu}%</span>
                    <span style={{ width: 54, textAlign: 'right' }}>{proc.memoryMb} MB</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tasks & Process Trees */}
          <div style={{ padding: '14px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            {t('resources.noActiveTasks')}
          </div>
        </div>
      )}
    </div>
  )
}
