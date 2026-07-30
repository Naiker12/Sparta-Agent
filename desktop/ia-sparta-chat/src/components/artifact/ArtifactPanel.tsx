import { useEffect, useMemo, useState } from 'react'
import { X, FileText, Download } from 'lucide-react'
import { useArtifactStore } from 'ia-sparta-core'
import { PreviewRenderer } from './PreviewRenderer'

interface FileData {
  content: string
  base64?: string
  encoding: string
}

export function ArtifactPanel() {
  const { openPath, close } = useArtifactStore()
  const [fileData, setFileData] = useState<FileData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fileName = useMemo(() => {
    if (!openPath) return ''
    const parts = openPath.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || ''
  }, [openPath])

  useEffect(() => {
    if (!openPath) { setFileData(null); setError(null); return }
    const path: string = openPath
    setLoading(true)
    setError(null)
    const ext = path.split('.').pop()?.toLowerCase()
    const binaryExts = ['pdf', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
    const needsBinary = binaryExts.includes(ext ?? '')

    async function load() {
      try {
        if (window.fs?.readFile) {
          const text = await window.fs.readFile(path)
          let base64: string | undefined
          if (needsBinary) {
            base64 = (await window.fs.readFile(path, 'base64')).content as string
          }
          setFileData({ content: text.content ?? '', base64, encoding: 'utf-8' })
        }
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [openPath])

  const handleDownload = async () => {
    if (!openPath) return
    // open the file location via shell
    if (window.electron?.send) {
      window.electron.send('shell:open-external', `file://${openPath}`)
    }
  }

  if (!openPath) return null

  return (
    <div style={{
      width: 480,
      borderLeft: '1px solid var(--border-subtle)',
      background: 'var(--bg-canvas)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          <FileText size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handleDownload} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }} title="Descargar">
            <Download size={16} />
          </button>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }} title="Cerrar">
            <X size={16} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {loading && <div style={{ color: 'var(--text-muted)' }}>Cargando…</div>}
        {error && <div style={{ color: 'var(--text-danger)' }}>Error: {error}</div>}
        {!loading && !error && fileData && (
          <PreviewRenderer filePath={openPath} content={fileData.content} base64={fileData.base64} />
        )}
      </div>
    </div>
  )
}
