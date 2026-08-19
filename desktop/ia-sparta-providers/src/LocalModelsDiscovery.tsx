import { useEffect, useState, useCallback } from 'react'
import { Cpu, RefreshCw, CheckCircle } from 'lucide-react'
import { fetchModelsByVendor } from 'ia-sparta-core'

export function LocalModelsDiscoveryBadge({ onDiscovered }: { onDiscovered?: (count: number) => void }) {
  const [count, setCount] = useState<number | null>(null)
  const [scanning, setScanning] = useState(false)

  const scan = useCallback(async () => {
    setScanning(true)
    const vendors = ['ollama', 'lmstudio', 'llamacpp'] as const
    try {
      const results = await Promise.allSettled(
        vendors.map((v) => fetchModelsByVendor(v, '', undefined))
      )
      const total = results
        .filter((r): r is PromiseFulfilledResult<{ models: string[]; error?: string }> => r.status === 'fulfilled')
        .reduce((sum, r) => sum + (r.value?.models?.length ?? 0), 0)

      setCount(total)
      onDiscovered?.(total)
    } catch {
      setCount(0)
    } finally {
      setScanning(false)
    }
  }, [onDiscovered])

  useEffect(() => {
    scan()
  }, [scan])

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
        border: '1px solid #E4DDD2',
        borderRadius: 999,
        padding: '3px 10px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        fontSize: 11,
        color: '#5C5245',
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
        userSelect: 'none',
      }}
    >
      {scanning ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#B45309' }}>
          <RefreshCw size={11} className="animate-spin" />
          <span style={{ fontWeight: 500 }}>Escaneando modelos en PC...</span>
        </span>
      ) : count && count > 0 ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#166534' }}>
          <CheckCircle size={11} color="#16A34A" />
          <span>
            <strong style={{ fontWeight: 700, color: '#14532D' }}>{count}</strong> {count === 1 ? 'modelo local detectado' : 'modelos locales detectados'}
          </span>
        </span>
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#786C5E' }}>
          <Cpu size={12} color="#B45309" />
          <span>Sin servidores locales activos</span>
        </span>
      )}

      <button
        onClick={scan}
        disabled={scanning}
        style={{
          background: 'none',
          border: 'none',
          padding: 2,
          marginLeft: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8A7D6F',
          cursor: scanning ? 'default' : 'pointer',
          borderRadius: 4,
          transition: 'color 0.15s, background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!scanning) {
            e.currentTarget.style.color = '#B45309'
            e.currentTarget.style.backgroundColor = '#F5EFE6'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#8A7D6F'
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
        title="Volver a escanear servidores locales (Ollama, LM Studio, vLLM, llama.cpp)"
        aria-label="Re-escanear modelos locales"
      >
        <RefreshCw size={10} className={scanning ? 'animate-spin' : ''} />
      </button>
    </div>
  )
}
