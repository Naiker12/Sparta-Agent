import { useMemo } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useThemeStore, isDarkTheme } from 'ia-sparta-core'

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
  const lang = useMemo(() => getLang(fileName), [fileName])

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: dark ? '#282c34' : '#fafafa', borderRadius: 0, margin: 0, padding: 0 }}>
      <SyntaxHighlighter
        language={lang}
        style={dark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          padding: '16px',
          borderRadius: 0,
          fontSize: 13,
          lineHeight: 1.5,
          minHeight: '100%',
          background: 'transparent',
        }}
        showLineNumbers
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
