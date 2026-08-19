import { useState, useEffect } from 'react'
import { SettingGroup, HardwareCard } from '../../shared'
import { Switch } from 'ia-sparta-design-system'
import { Cpu, Server, HardDrive, Zap } from 'lucide-react'

export function LiveMonitorSection() {
  const [liveUpdates, setLiveUpdates] = useState(true)
  const [cpuUsage, setCpuUsage] = useState(24)
  const [ramUsage, setRamUsage] = useState(68)
  const vramUsage = 42
  const diskUsage = 55

  // Polling simulator/live metrics when liveUpdates is active
  useEffect(() => {
    if (!liveUpdates) return

    const timer = setInterval(() => {
      setCpuUsage((prev) => {
        const delta = (Math.random() * 8 - 4)
        return Math.min(95, Math.max(12, Math.round(prev + delta)))
      })
      setRamUsage((prev) => {
        const delta = (Math.random() * 2 - 1)
        return Math.min(90, Math.max(50, Math.round(prev + delta)))
      })
    }, 2000)

    return () => clearInterval(timer)
  }, [liveUpdates])

  return (
    <SettingGroup
      title="Monitor de Hardware en Vivo"
      description="Consumo de CPU, memoria de sistema, VRAM de GPU y almacenamiento en tiempo real."
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>Actualizaciones en vivo</span>
          <Switch checked={liveUpdates} onCheckedChange={setLiveUpdates} />
        </div>
      }
    >
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <HardwareCard
          title="CPU"
          percentage={cpuUsage}
          detail="4/8 Núcleos Activos"
          subDetail="3.60 GHz"
          icon={<Cpu size={16} />}
        />

        <HardwareCard
          title="RAM del Sistema"
          percentage={ramUsage}
          detail="8.2 GB / 12.0 GB"
          subDetail="3.8 GB Libre"
          icon={<Server size={16} />}
        />

        <HardwareCard
          title="VRAM (GPU)"
          percentage={vramUsage}
          detail="3.4 GB / 8.0 GB"
          subDetail="RTX 3060 / CUDA"
          icon={<Zap size={16} />}
        />

        <HardwareCard
          title="Disco (D:\)"
          percentage={diskUsage}
          detail="480 GB / 930 GB"
          subDetail="NVMe SSD"
          icon={<HardDrive size={16} />}
        />
      </div>
    </SettingGroup>
  )
}
