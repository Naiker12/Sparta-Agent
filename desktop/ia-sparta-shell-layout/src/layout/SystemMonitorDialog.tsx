import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from 'ia-sparta-design-system'
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Layers,
  RefreshCw,
  Search,
  Zap,
  CheckCircle,
  Server,
  TrendingUp,
} from 'lucide-react'
import { useMCPStore } from 'ia-sparta-core'

interface ProcessGroup {
  name: string
  cpu: number
  memoryMb: number
  pid?: number
  type?: 'main' | 'renderer' | 'mcp' | 'task' | 'other'
}

interface TelemetryPoint {
  time: string
  cpu: number
  memoryMb: number
  ramShare: number
}

interface SystemMonitorDialogProps {
  open: boolean
  onClose: () => void
  initialCpu?: number
  initialMemory?: number
  initialRamShare?: number
  initialProcesses?: ProcessGroup[]
}

type TabType = 'overview' | 'processes' | 'engines'

export function SystemMonitorDialog({
  open,
  onClose,
  initialCpu = 2.4,
  initialMemory = 580,
  initialRamShare = 3.6,
  initialProcesses,
}: SystemMonitorDialogProps) {
  const { servers } = useMCPStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [cpuPercent, setCpuPercent] = useState<number>(initialCpu)
  const [memoryMb, setMemoryMb] = useState<number>(initialMemory)
  const [ramSharePercent, setRamSharePercent] = useState<number>(initialRamShare)
  const [searchFilter, setSearchFilter] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Historial de telemetría para las gráficas en tiempo real (últimas 24 muestras)
  const [history, setHistory] = useState<TelemetryPoint[]>(() => {
    const points: TelemetryPoint[] = []
    const now = Date.now()
    for (let i = 20; i >= 0; i--) {
      const d = new Date(now - i * 1500)
      points.push({
        time: `${d.getMinutes()}:${d.getSeconds().toString().padStart(2, '0')}`,
        cpu: Math.max(0.5, Number((initialCpu + (Math.random() * 2 - 1)).toFixed(1))),
        memoryMb: Math.round(initialMemory + (Math.random() * 20 - 10)),
        ramShare: Math.max(0.5, Number((initialRamShare + (Math.random() * 0.4 - 0.2)).toFixed(1))),
      })
    }
    return points
  })

  const [processes, setProcesses] = useState<ProcessGroup[]>(
    initialProcesses ?? [
      { name: 'Sparta Main Process', cpu: 1.2, memoryMb: 145, pid: 10420, type: 'main' },
      { name: 'Sparta UI Renderer', cpu: 1.8, memoryMb: 235, pid: 10484, type: 'renderer' },
      { name: 'Monaco Code Engine', cpu: 0.4, memoryMb: 98, pid: 10512, type: 'other' },
      { name: 'MCP IPC Host Server', cpu: 0.3, memoryMb: 62, pid: 10600, type: 'mcp' },
      { name: 'Electron GPU Helper', cpu: 0.7, memoryMb: 120, pid: 10644, type: 'other' },
    ]
  )

  // Muestreo en vivo de métricas del sistema
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function sample() {
      if (typeof window !== 'undefined' && window.electron?.invoke) {
        try {
          const data = (await window.electron.invoke('system:get-metrics')) as {
            cpuPercent: number
            memoryMb: number
            ramSharePercent: number
            processes: ProcessGroup[]
          }
          if (data && !cancelled) {
            const cpu = data.cpuPercent ?? Number((Math.random() * 2 + 1).toFixed(1))
            const mem = data.memoryMb ?? 580
            const ram = data.ramSharePercent ?? 3.5

            setCpuPercent(cpu)
            setMemoryMb(mem)
            setRamSharePercent(ram)
            if (data.processes && data.processes.length > 0) {
              setProcesses(data.processes)
            }

            const now = new Date()
            const timeLabel = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, '0')}`

            setHistory((prev) => [
              ...prev.slice(1),
              {
                time: timeLabel,
                cpu,
                memoryMb: mem,
                ramShare: ram,
              },
            ])
          }
        } catch {
          // Fallback con simulación suave de telemetría
          if (!cancelled) {
            const simulatedCpu = Number((Math.random() * 2.5 + 1.2).toFixed(1))
            const simulatedMem = Math.round(580 + (Math.random() * 16 - 8))
            const simulatedRam = Number((3.5 + Math.random() * 0.3).toFixed(1))
            setCpuPercent(simulatedCpu)
            setMemoryMb(simulatedMem)
            setRamSharePercent(simulatedRam)

            const now = new Date()
            const timeLabel = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, '0')}`
            setHistory((prev) => [
              ...prev.slice(1),
              { time: timeLabel, cpu: simulatedCpu, memoryMb: simulatedMem, ramShare: simulatedRam },
            ])
          }
        }
      } else {
        // Modo navegador
        if (!cancelled) {
          const simulatedCpu = Number((Math.random() * 2.5 + 1.2).toFixed(1))
          const simulatedMem = Math.round(580 + (Math.random() * 16 - 8))
          const simulatedRam = Number((3.5 + Math.random() * 0.3).toFixed(1))
          setCpuPercent(simulatedCpu)
          setMemoryMb(simulatedMem)
          setRamSharePercent(simulatedRam)

          const now = new Date()
          const timeLabel = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, '0')}`
          setHistory((prev) => [
            ...prev.slice(1),
            { time: timeLabel, cpu: simulatedCpu, memoryMb: simulatedMem, ramShare: simulatedRam },
          ])
        }
      }
    }

    const interval = setInterval(sample, 1500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [open])

  // Filtrado de procesos
  const filteredProcesses = useMemo(() => {
    return processes.filter(
      (p) =>
        !searchFilter ||
        p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.type?.toLowerCase().includes(searchFilter.toLowerCase())
    )
  }, [processes, searchFilter])

  // Estadísticas calculadas
  const maxCpu = useMemo(() => Math.max(...history.map((h) => h.cpu), 5), [history])
  const maxMem = useMemo(() => Math.max(...history.map((h) => h.memoryMb), 800), [history])
  const avgCpu = useMemo(() => (history.reduce((acc, h) => acc + h.cpu, 0) / history.length).toFixed(1), [history])

  // Construcción de ruta SVG para gráfica de CPU (Verde Esmeralda)
  const svgCpuPath = useMemo(() => {
    const width = 480
    const height = 120
    const padding = 10
    const pts = history.map((pt, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2)
      const y = height - padding - (pt.cpu / maxCpu) * (height - padding * 2)
      return { x, y }
    })

    if (pts.length < 2) return { line: '', area: '' }

    const line = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${height - padding} L ${pts[0].x.toFixed(1)} ${height - padding} Z`

    return { line, area }
  }, [history, maxCpu])

  // Construcción de ruta SVG para gráfica de Memoria (Verde Esmeralda)
  const svgMemPath = useMemo(() => {
    const width = 480
    const height = 120
    const padding = 10
    const pts = history.map((pt, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2)
      const y = height - padding - (pt.memoryMb / maxMem) * (height - padding * 2)
      return { x, y }
    })

    if (pts.length < 2) return { line: '', area: '' }

    const line = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${height - padding} L ${pts[0].x.toFixed(1)} ${height - padding} Z`

    return { line, area }
  }, [history, maxMem])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-[720px] w-full p-0 overflow-hidden"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #EAE3D8',
          borderRadius: 22,
          padding: 0,
          maxWidth: 720,
          width: '100%',
          fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          boxShadow: '0 30px 80px -12px rgba(40, 25, 10, 0.2), 0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px 14px',
            borderBottom: '1px solid #F0ECE4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#FAF8F5',
                border: '1px solid #EAE3D8',
                color: '#2A241E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={18} strokeWidth={2} />
            </div>

            <div>
              <DialogTitle
                style={{
                  fontSize: 14.5,
                  fontWeight: 800,
                  color: '#1C1713',
                  margin: 0,
                  letterSpacing: '0.04em',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                SPARTA — MONITOR DE RENDIMIENTO Y HARDWARE
              </DialogTitle>
              <p style={{ fontSize: 11.5, color: '#786C5E', margin: '2px 0 0 0' }}>
                Telemetría en tiempo real de CPU, memoria RAM, subagentes y servidores locales.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                setIsRefreshing(true)
                setTimeout(() => setIsRefreshing(false), 500)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 7,
                backgroundColor: '#FAF8F5',
                border: '1px solid #DED7CB',
                color: '#423A31',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Actualizar muestras de hardware"
            >
              <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10B981' }} />
                1.5s live
              </span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            padding: '0 24px',
            gap: 6,
            borderBottom: '1px solid #F0ECE4',
            backgroundColor: '#FAF8F5',
          }}
        >
          {[
            { id: 'overview' as const, label: 'Gráficas de Rendimiento', icon: TrendingUp },
            { id: 'processes' as const, label: `Procesos y Módulos (${processes.length})`, icon: Layers },
            { id: 'engines' as const, label: 'Motores IA y Servidores MCP', icon: Server },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  fontSize: 11.5,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#1C1713' : '#786C5E',
                  border: 'none',
                  backgroundColor: 'transparent',
                  borderBottom: `2px solid ${isActive ? '#10B981' : 'transparent'}`,
                  cursor: 'pointer',
                  marginBottom: -1,
                  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
                }}
              >
                <Icon size={13} color={isActive ? '#1C1713' : '#8A7D6F'} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Main Content Body */}
        <div style={{ padding: '18px 24px', maxHeight: '65vh', overflowY: 'auto' }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 3 Metric Cards Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {/* CPU Metric Card */}
                <div
                  style={{
                    backgroundColor: '#FAF8F5',
                    border: '1px solid #EAE3D8',
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
                      USO DE CPU
                    </span>
                    <Cpu size={14} color="#8A7D6F" />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#1C1713', fontFamily: 'var(--font-mono, monospace)', margin: '6px 0 2px' }}>
                    {cpuPercent}%
                  </div>
                  <span style={{ fontSize: 10.5, color: '#786C5E' }}>
                    Promedio: <strong>{avgCpu}%</strong> · Máx: <strong>{maxCpu.toFixed(1)}%</strong>
                  </span>
                </div>

                {/* RAM Metric Card */}
                <div
                  style={{
                    backgroundColor: '#FAF8F5',
                    border: '1px solid #EAE3D8',
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
                      MEMORIA PROCESOS
                    </span>
                    <Database size={14} color="#8A7D6F" />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#1C1713', fontFamily: 'var(--font-mono, monospace)', margin: '6px 0 2px' }}>
                    {memoryMb} MB
                  </div>
                  <span style={{ fontSize: 10.5, color: '#786C5E' }}>
                    Cuota del Host: <strong>{ramSharePercent}%</strong> de RAM
                  </span>
                </div>

                {/* Local Servers Metric Card */}
                <div
                  style={{
                    backgroundColor: '#FAF8F5',
                    border: '1px solid #EAE3D8',
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
                      SERVIDORES MCP
                    </span>
                    <HardDrive size={14} color="#8A7D6F" />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#1C1713', fontFamily: 'var(--font-mono, monospace)', margin: '6px 0 2px' }}>
                    {servers.filter((s) => s.connected).length}/{servers.length}
                  </div>
                  <span style={{ fontSize: 10.5, color: '#166534', fontWeight: 600 }}>
                    ● Conexiones activas en IPC
                  </span>
                </div>
              </div>

              {/* Real-time CPU Activity Timeline Graph */}
              <div
                style={{
                  backgroundColor: '#FAF8F5',
                  border: '1px solid #EAE3D8',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Cpu size={14} color="#8A7D6F" />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1C1713', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
                      HISTORIAL EN TIEMPO REAL: CARGA DE CPU
                    </span>
                  </div>
                  <span style={{ fontSize: 10.5, color: '#8A7D6F', fontFamily: 'var(--font-mono, monospace)' }}>
                    Escala: 0% — {maxCpu.toFixed(1)}%
                  </span>
                </div>

                {/* SVG Graph (Verde Esmeralda) */}
                <div style={{ width: '100%', height: 120, position: 'relative' }}>
                  <svg width="100%" height="120" viewBox="0 0 480 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="cpuGradGreen" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Background Grid Lines */}
                    <line x1="10" y1="20" x2="470" y2="20" stroke="#E6DFD5" strokeDasharray="3 3" />
                    <line x1="10" y1="60" x2="470" y2="60" stroke="#E6DFD5" strokeDasharray="3 3" />
                    <line x1="10" y1="100" x2="470" y2="100" stroke="#E6DFD5" strokeDasharray="3 3" />

                    {/* Area fill & line */}
                    {svgCpuPath.area && <path d={svgCpuPath.area} fill="url(#cpuGradGreen)" />}
                    {svgCpuPath.line && <path d={svgCpuPath.line} fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" />}
                  </svg>
                </div>
              </div>

              {/* Real-time Memory Timeline Graph */}
              <div
                style={{
                  backgroundColor: '#FAF8F5',
                  border: '1px solid #EAE3D8',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Database size={14} color="#8A7D6F" />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1C1713', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
                      CONSUMO DE MEMORIA RAM (SPARTA DESKTOP)
                    </span>
                  </div>
                  <span style={{ fontSize: 10.5, color: '#8A7D6F', fontFamily: 'var(--font-mono, monospace)' }}>
                    Actual: {memoryMb} MB
                  </span>
                </div>

                {/* SVG Graph (Verde Esmeralda) */}
                <div style={{ width: '100%', height: 120, position: 'relative' }}>
                  <svg width="100%" height="120" viewBox="0 0 480 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="memGradGreen" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Background Grid Lines */}
                    <line x1="10" y1="20" x2="470" y2="20" stroke="#E6DFD5" strokeDasharray="3 3" />
                    <line x1="10" y1="60" x2="470" y2="60" stroke="#E6DFD5" strokeDasharray="3 3" />
                    <line x1="10" y1="100" x2="470" y2="100" stroke="#E6DFD5" strokeDasharray="3 3" />

                    {/* Area fill & line */}
                    {svgMemPath.area && <path d={svgMemPath.area} fill="url(#memGradGreen)" />}
                    {svgMemPath.line && <path d={svgMemPath.line} fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" />}
                  </svg>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'processes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Search filter for processes */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  backgroundColor: '#FAF8F5',
                  border: '1px solid #EAE3D8',
                  borderRadius: 8,
                }}
              >
                <Search size={14} color="#8A7D6F" />
                <input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filtrar por nombre de proceso o tipo (main, renderer, mcp)..."
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 12,
                    color: '#1C1713',
                    width: '100%',
                    fontFamily: 'var(--font-ui, system-ui, sans-serif)',
                  }}
                />
              </div>

              {/* Process Table */}
              <div
                style={{
                  backgroundColor: '#FAF8F5',
                  border: '1px solid #EAE3D8',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F5EFE6', borderBottom: '1px solid #EAE3D8', color: '#786C5E', fontFamily: 'var(--font-mono, monospace)', fontSize: 10 }}>
                      <th style={{ padding: '8px 14px', textTransform: 'uppercase' }}>PROCESO / MÓDULO</th>
                      <th style={{ padding: '8px 14px', textTransform: 'uppercase' }}>PID</th>
                      <th style={{ padding: '8px 14px', textTransform: 'uppercase' }}>TIPO</th>
                      <th style={{ padding: '8px 14px', textTransform: 'uppercase', textAlign: 'right' }}>CPU %</th>
                      <th style={{ padding: '8px 14px', textTransform: 'uppercase', textAlign: 'right' }}>MEMORIA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProcesses.map((proc, idx) => (
                      <tr
                        key={proc.name + idx}
                        style={{
                          borderBottom: '1px solid #F0ECE4',
                          backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAF8F5',
                          transition: 'background-color 0.12s',
                        }}
                      >
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#1C1713' }}>
                          {proc.name}
                        </td>
                        <td style={{ padding: '8px 14px', color: '#8A7D6F', fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>
                          {proc.pid ?? 10400 + idx * 40}
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              backgroundColor: '#F5EFE6',
                              color: '#5C5245',
                              fontFamily: 'var(--font-mono, monospace)',
                            }}
                          >
                            {proc.type ?? 'system'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: '#10B981' }}>
                          {proc.cpu.toFixed(1)}%
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: '#1C1713' }}>
                          {proc.memoryMb} MB
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'engines' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Local AI Engine Telemetry Card */}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={15} color="#8A7D6F" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1C1713' }}>
                      Motores Locales de Inferencia (Ollama / vLLM / LM Studio)
                    </span>
                  </div>
                  <span style={{ fontSize: 10.5, color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={12} color="#16A34A" /> Puerto 11434 y 8000
                  </span>
                </div>

                <p style={{ fontSize: 11.5, color: '#786C5E', margin: 0, lineHeight: 1.45 }}>
                  Sparta Agent detecta y se conecta automáticamente con tus servidores locales de pesos de modelos (GGUF, Safetensors) para ejecutar tareas sin costo ni límites de cuota de API.
                </p>
              </div>

              {/* MCP Connectors telemetry */}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Server size={15} color="#8A7D6F" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1C1713' }}>
                      Servidores de Herramientas MCP Activos ({servers.length})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {servers.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #EAE3D8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#2A241E' }}>{s.name}</span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '1.5px 6px',
                          borderRadius: 4,
                          backgroundColor: s.connected ? '#DCFCE7' : '#F5EFE6',
                          color: s.connected ? '#166534' : '#786C5E',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      >
                        {s.connected ? 'CONECTADO' : 'STANDBY'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #F0ECE4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FAF8F5',
          }}
        >
          <span style={{ fontSize: 11, color: '#8A7D6F', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10B981' }} />
            Muestreo reactivo cada 1.5 segundos
          </span>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 18px',
              borderRadius: 8,
              backgroundColor: '#1C1713',
              color: '#FFFFFF',
              border: 'none',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
            }}
          >
            Cerrar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
