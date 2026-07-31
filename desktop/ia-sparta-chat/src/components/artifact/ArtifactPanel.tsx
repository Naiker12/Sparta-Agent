import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { X, FileText, Download, Copy, Check, Eye, Code } from 'lucide-react'
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
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview')
  const [copied, setCopied] = useState(false)

  // Resizable panel state & iframe blocker
  const [panelWidth, setPanelWidth] = useState(540)
  const [isResizing, setIsResizing] = useState(false)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(540)
  const rafIdRef = useRef<number | null>(null)

  const fileName = useMemo(() => {
    if (!openPath) return ''
    const parts = openPath.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || ''
  }, [openPath])

  const isPreviewable = useMemo(() => {
    if (!openPath) return false
    const ext = openPath.split('.').pop()?.toLowerCase() ?? ''
    return ['html', 'htm', 'md', 'markdown', 'svg'].includes(ext)
  }, [openPath])

  useEffect(() => {
    if (!openPath) {
      setFileData(null)
      setError(null)
      return
    }
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
    if (window.electron?.send) {
      window.electron.send('shell:open-external', `file://${openPath}`)
    }
  }

  const handleCopyCode = async () => {
    if (!fileData?.content) return
    try {
      await navigator.clipboard.writeText(fileData.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* noop */ }
  }

  // ── Drag Resizing Logic (60fps rAF + Fullscreen Overlay) ────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = panelWidth
    setIsResizing(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)

      rafIdRef.current = requestAnimationFrame(() => {
        const deltaX = startXRef.current - moveEvent.clientX
        const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, 340), window.innerWidth * 0.85)
        setPanelWidth(newWidth)
      })
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      setIsResizing(false)
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
  }, [panelWidth])

  if (!openPath) return null

  return (
    <>
      {/* ── Overlay transparente para prevenir que el iframe capture el ratón ── */}
      {isResizing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            cursor: 'col-resize',
            userSelect: 'none',
          }}
        />
      )}

      <div
        style={{
          width: panelWidth,
          position: 'relative',
          borderLeft: '1px solid var(--border-subtle)',
          background: 'var(--bg-sidebar)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.06)',
        }}
      >
        {/* ── Resizable Drag Handle & Centered Pill Grip ─────────────── */}
        <div
          onMouseDown={handleMouseDown}
          className="artifact-resize-handle"
          title="Arrastra para redimensionar el panel"
        >
          <div className="artifact-resize-line" />
          <div className="artifact-resize-pill" />
        </div>

        {/* ── Header (Coincide con el tono del sidebar) ──────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-sidebar)',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minWidth: 0 }}>
            <FileText size={16} style={{ flexShrink: 0, color: 'var(--accent)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fileName}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {openPath}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {isPreviewable && (
              <div
                style={{
                  display: 'flex',
                  background: 'var(--bg-surface)',
                  padding: 2,
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  onClick={() => setViewMode('preview')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                    background: viewMode === 'preview' ? 'var(--bg-elevated)' : 'transparent',
                    color: viewMode === 'preview' ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Eye size={13} />
                  Vista previa
                </button>

                <button
                  onClick={() => setViewMode('code')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                    background: viewMode === 'code' ? 'var(--bg-elevated)' : 'transparent',
                    color: viewMode === 'code' ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Code size={13} />
                  Código
                </button>
              </div>
            )}

            <button
              onClick={handleCopyCode}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '5px 8px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
              }}
              title="Copiar código al portapapeles"
            >
              {copied ? <Check size={14} color="var(--status-ok)" /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>

            <button
              onClick={handleDownload}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 5,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
              }}
              title="Abrir ubicación de archivo"
            >
              <Download size={15} />
            </button>

            <button
              onClick={close}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 5,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
              }}
              title="Cerrar panel de artefacto"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Content Container (Full Height, Pointer Events Safe) ───── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            padding: 0,
            margin: 0,
            background: 'var(--bg-sidebar)',
            pointerEvents: isResizing ? 'none' : 'auto',
          }}
        >
          {loading && <div style={{ color: 'var(--text-muted)', padding: 16 }}>Cargando vista previa…</div>}
          {error && <div style={{ color: 'var(--status-err)', padding: 16 }}>Error: {error}</div>}
          {!loading && !error && fileData && (
            <PreviewRenderer filePath={openPath} content={fileData.content} base64={fileData.base64} viewMode={viewMode} />
          )}
        </div>
      </div>
    </>
  )
}
