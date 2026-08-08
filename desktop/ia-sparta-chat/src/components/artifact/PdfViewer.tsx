import { useEffect, useState } from 'react'

interface PdfViewerProps {
  base64: string
  fileName: string
}

export function PdfViewer({ base64 }: PdfViewerProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    try {
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setSrc(url)
      return () => URL.revokeObjectURL(url)
    } catch {
      setError(true)
    }
  }, [base64])

  if (error) return <div style={{ padding: 16, color: 'var(--text-danger)' }}>Error al cargar PDF</div>
  if (!src) return <div style={{ padding: 16, color: 'var(--text-muted)' }}>Cargando PDF…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <embed src={src} type="application/pdf" style={{ width: '100%', flex: 1, minHeight: 400, borderRadius: 0, border: 'none' }} />
    </div>
  )
}
