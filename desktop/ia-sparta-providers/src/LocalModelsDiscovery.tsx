import { useEffect, useState, useCallback } from 'react'
import { Cpu, RefreshCw } from 'lucide-react'
import { Badge } from 'ia-sparta-design-system'
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

  if (count === null && !scanning) return null

  return (
    <div className="inline-flex items-center gap-1.5">
      <Badge
        variant="secondary"
        className="gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] select-none"
      >
        <Cpu className="size-3 text-[var(--accent)]" />
        {scanning ? (
          <span className="animate-pulse">Buscando modelos locales...</span>
        ) : count && count > 0 ? (
          <span>
            <strong className="text-[var(--text-primary)] font-semibold">{count}</strong> modelo{count !== 1 ? 's' : ''} local{count !== 1 ? 'es' : ''} encontrado{count !== 1 ? 's' : ''}
          </span>
        ) : (
          <span>Sin modelos locales activos</span>
        )}
      </Badge>
      <button
        onClick={scan}
        disabled={scanning}
        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
        title="Volver a escanear servidores locales (Ollama, LM Studio, LLaMA.cpp)"
        aria-label="Re-escanear modelos locales"
      >
        <RefreshCw className={`size-3 ${scanning ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}
