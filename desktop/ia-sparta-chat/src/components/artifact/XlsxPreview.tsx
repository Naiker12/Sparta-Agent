import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet } from 'lucide-react'

interface XlsxPreviewProps {
  base64: string
  fileName: string
}

export function XlsxPreview({ base64, fileName }: XlsxPreviewProps) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)

  const workbook = useMemo(() => {
    if (!base64) return null
    try {
      return XLSX.read(base64, { type: 'base64' })
    } catch (err) {
      console.error('Error parsing Excel file:', err)
      return null
    }
  }, [base64])

  const sheetNames = useMemo(() => {
    return workbook?.SheetNames ?? []
  }, [workbook])

  const activeSheetData = useMemo(() => {
    if (!workbook || sheetNames.length === 0) return null
    const currentName = sheetNames[activeSheetIndex] || sheetNames[0]
    const sheet = workbook.Sheets[currentName]
    if (!sheet) return null

    // Convert sheet to array of arrays
    const rawData = XLSX.utils.sheet_to_json<Array<string | number | boolean>>(sheet, { header: 1, defval: '' })
    return rawData
  }, [workbook, sheetNames, activeSheetIndex])

  const maxRows = 250
  const displayRows = useMemo(() => {
    if (!activeSheetData) return []
    return activeSheetData.slice(0, maxRows)
  }, [activeSheetData])

  if (!workbook || sheetNames.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        <FileSpreadsheet size={32} style={{ marginBottom: 8, opacity: 0.6 }} />
        <div style={{ fontSize: 13, fontWeight: 500 }}>No se pudo parsear la hoja de cálculo</div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Verifica que el archivo no esté dañado o protegido con contraseña.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-surface)' }}>
      {/* Sheet Selector Tabs */}
      {sheetNames.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-sidebar)',
            overflowX: 'auto',
          }}
        >
          {sheetNames.map((name, index) => (
            <button
              key={name}
              onClick={() => setActiveSheetIndex(index)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: index === activeSheetIndex ? 600 : 400,
                border: 'none',
                cursor: 'pointer',
                background: index === activeSheetIndex ? 'var(--accent)' : 'transparent',
                color: index === activeSheetIndex ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Info bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          fontSize: 11,
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span>{fileName} — {sheetNames[activeSheetIndex] ?? 'Hoja 1'}</span>
        <span>{activeSheetData?.length ?? 0} filas {activeSheetData && activeSheetData.length > maxRows ? `(mostrando primeras ${maxRows})` : ''}</span>
      </div>

      {/* Grid Container */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {!activeSheetData || activeSheetData.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Hoja de cálculo vacía</div>
        ) : (
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
              <tbody>
                {displayRows.map((row, rowIndex) => (
                  <tr key={rowIndex} style={{ background: rowIndex === 0 ? 'var(--bg-elevated)' : undefined }}>
                    <td
                      style={{
                        padding: '4px 8px',
                        borderBottom: '1px solid var(--border-subtle)',
                        borderRight: '1px solid var(--border-subtle)',
                        background: 'var(--bg-sidebar)',
                        color: 'var(--text-muted)',
                        fontSize: 10,
                        textAlign: 'center',
                        userSelect: 'none',
                        width: 32,
                        minWidth: 32,
                      }}
                    >
                      {rowIndex + 1}
                    </td>
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        style={{
                          padding: '5px 10px',
                          borderBottom: '1px solid var(--border-subtle)',
                          borderRight: '1px solid var(--border-subtle)',
                          maxWidth: 320,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: rowIndex === 0 ? 600 : 400,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {String(cell ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
