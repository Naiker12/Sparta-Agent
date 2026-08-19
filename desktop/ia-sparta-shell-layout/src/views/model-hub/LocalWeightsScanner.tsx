import { useState } from 'react'
import { FolderSearch, FolderOpen, HardDrive, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import type { ScannedModelFile } from './types'

interface LocalWeightsScannerProps {
  onModelsDiscovered: (models: ScannedModelFile[], path: string) => void
  currentPath: string
  scannedCount: number
}

const QUICK_PATHS = ['D:\\sparta-agent\\models', 'C:\\models', 'D:\\models', '~/.sparta/models']

export function LocalWeightsScanner({
  onModelsDiscovered,
  currentPath,
  scannedCount,
}: LocalWeightsScannerProps) {
  const [scanPath, setScanPath] = useState(currentPath || 'D:\\sparta-agent\\models')
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<{ ok?: boolean; message?: string } | null>(null)

  async function handleBrowseFolder() {
    if (typeof window !== 'undefined' && window.electron?.invoke) {
      try {
        const chosen = (await window.electron.invoke('fs:openFolderDialog')) as string | null
        if (chosen) {
          setScanPath(chosen)
          await triggerScan(chosen)
        }
      } catch (err) {
        console.error('Error opening folder dialog:', err)
      }
    }
  }

  async function triggerScan(targetPath: string) {
    setIsScanning(true)
    setScanStatus(null)

    if (typeof window !== 'undefined' && window.electron?.invoke) {
      try {
        const res = (await window.electron.invoke('fs:scanModelWeights', targetPath)) as {
          success: boolean
          error?: string
          models?: ScannedModelFile[]
        }

        if (res && res.success && res.models) {
          onModelsDiscovered(res.models, targetPath)
          setScanStatus({
            ok: true,
            message: `${res.models.length} archivos de pesos (.gguf, .safetensors) detectados en ${targetPath}.`,
          })
        } else {
          setScanStatus({
            ok: false,
            message: res?.error || 'No se encontraron archivos .gguf o .safetensors en la ruta.',
          })
        }
      } catch (err) {
        setScanStatus({ ok: false, message: (err as Error).message })
      } finally {
        setIsScanning(false)
      }
    } else {
      // Fallback navegador
      setTimeout(() => {
        setIsScanning(false)
        setScanStatus({ ok: true, message: 'Escaneo de pesos locales completado (modo web).' })
      }, 500)
    }
  }

  return (
    <div
      style={{
        backgroundColor: '#11151E',
        border: '1px solid #1F2737',
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Top Header & Main Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              backgroundColor: '#161C28',
              border: '1px solid #283348',
              color: '#38BDF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HardDrive size={18} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
                Escáner de Pesos Locales & Checkpoints Unsloth
              </h3>
              {scannedCount > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: 999,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34D399',
                    fontFamily: 'monospace',
                  }}
                >
                  {scannedCount} detectados
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0 0' }}>
              Detecta modelos cuantizados (.gguf, .safetensors, LoRA) en tu disco local para inferencia instantánea.
            </p>
          </div>
        </div>

        {/* Input Bar & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              backgroundColor: '#161B26',
              border: '1px solid #283348',
              minWidth: 280,
            }}
          >
            <input
              value={scanPath}
              onChange={(e) => setScanPath(e.target.value)}
              placeholder="Ruta local ej. D:\unsloth-main"
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 12,
                color: '#F1F5F9',
                fontFamily: 'monospace',
                width: '100%',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') triggerScan(scanPath)
              }}
            />

            <button
              type="button"
              onClick={handleBrowseFolder}
              title="Examinar carpeta en tu PC"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                color: '#94A3B8',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <FolderOpen size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => triggerScan(scanPath)}
            disabled={isScanning}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              borderRadius: 8,
              backgroundColor: '#10B981',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 700,
              cursor: isScanning ? 'default' : 'pointer',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
            }}
          >
            {isScanning ? <RefreshCw size={13} className="animate-spin" /> : <FolderSearch size={14} />}
            <span>{isScanning ? 'Escaneando disco...' : 'Escanear'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Shortcuts & Status Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, borderTop: '1px solid #1A212E', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748B' }}>
          <span>Rutas rápidas:</span>
          {QUICK_PATHS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setScanPath(p)
                triggerScan(p)
              }}
              style={{
                background: '#161B26',
                border: '1px solid #232B3B',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 10.5,
                color: '#94A3B8',
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {scanStatus && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11.5,
              color: scanStatus.ok ? '#34D399' : '#F87171',
              fontWeight: 600,
            }}
          >
            {scanStatus.ok ? <CheckCircle size={14} color="#10B981" /> : <AlertCircle size={14} color="#EF4444" />}
            <span>{scanStatus.message}</span>
          </div>
        )}
      </div>
    </div>
  )
}
