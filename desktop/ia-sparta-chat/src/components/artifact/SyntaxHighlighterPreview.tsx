import { useMemo, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useThemeStore, isDarkTheme } from 'ia-sparta-core'
import { Copy, Check } from 'lucide-react'

interface SyntaxHighlighterPreviewProps {
  code: string
  fileName: string
}

function getLang(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    json: 'json', py: 'python', rs: 'rust', go: 'go',
    java: 'java', c: 'c', cpp: 'cpp', h: 'c',
    css: 'css', scss: 'scss', html: 'html', xml: 'xml',
    yaml: 'yaml', yml: 'yaml', toml: 'ini',
    sh: 'bash', bash: 'bash', sql: 'sql', graphql: 'graphql',
    md: 'markdown',
  }
  return ext ? map[ext] ?? ext : 'text'
}

export function SyntaxHighlighterPreview({ code, fileName }: SyntaxHighlighterPreviewProps) {
  const theme = useThemeStore((s) => s.theme)
  const dark = isDarkTheme(theme)
  const [copied, setCopied] = useState(false)
  const lang = useMemo(() => getLang(fileName), [fileName])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* noop */ }
  }

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
        <span>{fileName}</span>
        <button onClick={handleCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }} title="Copiar">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <div style={{ maxHeight: 500, overflow: 'auto' }}>
        <SyntaxHighlighter
          language={lang}
          style={dark ? oneDark : oneLight}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: 13, lineHeight: 1.5 }}
          showLineNumbers
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
