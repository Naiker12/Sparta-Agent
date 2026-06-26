import { useMemo } from 'react'

interface DiffLine {
  type: 'add' | 'del' | 'same'
  content: string
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const lines: DiffLine[] = []

  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]
    if (oldLine === undefined && newLine !== undefined) {
      lines.push({ type: 'add', content: newLine })
    } else if (oldLine !== undefined && newLine === undefined) {
      lines.push({ type: 'del', content: oldLine })
    } else if (oldLine !== newLine) {
      lines.push({ type: 'del', content: oldLine! })
      lines.push({ type: 'add', content: newLine! })
    } else {
      lines.push({ type: 'same', content: oldLine! })
    }
  }

  return lines
}

function isFileEditTool(toolName: string): boolean {
  const fileTools = ['write_file', 'edit_file', 'create_file', 'patch_file', 'fs_write', 'fs_edit']
  return fileTools.includes(toolName)
}

interface ToolCallDiffViewProps {
  toolName: string
  input: unknown
  output?: string
}

export function ToolCallDiffView({ toolName, input, output }: ToolCallDiffViewProps) {
  const diff = useMemo(() => {
    if (!isFileEditTool(toolName)) return null
    if (!output) return null

    const inp = input as { file_path?: string; content?: string; old_string?: string; new_string?: string }
    const oldContent = inp.old_string || ''
    const newContent = output

    return {
      filePath: inp.file_path || 'unknown',
      lines: computeDiff(oldContent, newContent),
    }
  }, [toolName, input, output])

  if (!diff) return null

  const addCount = diff.lines.filter((l) => l.type === 'add').length
  const delCount = diff.lines.filter((l) => l.type === 'del').length

  return (
    <div style={{
      background: 'var(--bg-base)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: 10.5,
        color: 'var(--text-muted)',
      }}>
        <span>{diff.filePath}</span>
        <span style={{ color: 'var(--status-ok)' }}>+{addCount}</span>
        <span style={{ color: 'var(--status-err)' }}>-{delCount}</span>
      </div>
      <div style={{ padding: '4px 0', maxHeight: 200, overflowY: 'auto' }}>
        {diff.lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              padding: '1px 8px',
              background: line.type === 'add'
                ? 'rgba(34, 197, 94, 0.08)'
                : line.type === 'del'
                ? 'rgba(239, 68, 68, 0.08)'
                : 'none',
              color: line.type === 'add'
                ? 'var(--status-ok)'
                : line.type === 'del'
                ? 'var(--status-err)'
                : 'var(--text-muted)',
            }}
          >
            <span style={{ width: 16, flexShrink: 0, textAlign: 'center' }}>
              {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
            </span>
            <span style={{ whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {line.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
