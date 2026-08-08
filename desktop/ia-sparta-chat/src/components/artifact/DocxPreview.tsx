import { useEffect, useState } from 'react'
import mammoth from 'mammoth'
import { FileText, AlertCircle } from 'lucide-react'

interface DocxPreviewProps {
  base64: string
  fileName: string
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

export function DocxPreview({ base64, fileName }: DocxPreviewProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!base64) {
      setError('No se proporcionaron datos de archivo')
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    async function parseDocx() {
      try {
        const arrayBuffer = base64ToArrayBuffer(base64)
        const result = await mammoth.convertToHtml({ arrayBuffer })
        if (isMounted) {
          // Sanitize mammoth output to strip potentially dangerous elements
          let html = result.value
          html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
          html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
          html = html.replace(/<object[\s\S]*?<\/object>/gi, '')
          html = html.replace(/<embed[^>]*>/gi, '')
          html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
          html = html.replace(/(href\s*=\s*["'])javascript:[^"']*(["'])/gi, '$1#$2')
          setHtmlContent(html)
        }
      } catch (err) {
        console.error('Error parsing Word document:', err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error al procesar el archivo Word (.docx)')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    parseDocx()

    return () => {
      isMounted = false
    }
  }, [base64])

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        <FileText size={28} className="animate-pulse" style={{ marginBottom: 8, opacity: 0.6 }} />
        <div style={{ fontSize: 13 }}>Procesando documento Word…</div>
      </div>
    )
  }

  if (error || htmlContent === null) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--status-err)' }}>
        <AlertCircle size={28} style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 13, fontWeight: 500 }}>No se pudo previsualizar el documento</div>
        <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{error ?? 'Formato no soportado'}</div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-surface)', padding: 20 }}>
      {/* Paper container simulation */}
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '32px 40px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          color: 'var(--text-primary)',
          fontSize: 14,
          lineHeight: 1.6,
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 16 }}>
          Documento Word — {fileName}
        </div>
        <div
          className="docx-content-preview"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  )
}
