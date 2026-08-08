import { useMemo } from 'react'

interface SheetPreviewProps {
  base64: string
  fileName: string
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    values.push(current.trim())
    rows.push(values)
  }
  return rows
}

export function SheetPreview({ base64, fileName }: SheetPreviewProps) {
  const ext = fileName.split('.').pop()?.toLowerCase()

  const data = useMemo(() => {
    if (ext === 'csv') {
      try {
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const text = new TextDecoder('utf-8').decode(bytes)
        return parseCSV(text)
      } catch {
        return null
      }
    }
    return null
  }, [ext, base64])

  const displayRows = useMemo(() => {
    if (!data) return []
    const maxRows = 200
    const rows = data.slice(0, maxRows)
    if (data.length > maxRows) rows.push([`… y ${data.length - maxRows} filas más`])
    return rows
  }, [data])

  if (ext !== 'csv') {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
        Vista previa no disponible para archivos <code>.{ext}</code>. Abre el archivo en una aplicación externa para ver su contenido.
      </div>
    )
  }

  if (!data) {
    return <div style={{ padding: 16, color: 'var(--text-danger)' }}>Error al leer el archivo CSV</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fileName} — {data.length} filas</div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} style={{ background: i === 0 ? 'var(--bg-surface)' : undefined, fontWeight: i === 0 ? 600 : undefined }}>
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: '4px 10px', borderBottom: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
