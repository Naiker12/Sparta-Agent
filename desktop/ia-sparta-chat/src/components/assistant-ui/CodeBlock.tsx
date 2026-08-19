import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useThemeStore, isDarkTheme } from 'ia-sparta-core'

interface CodeBlockProps {
  language?: string
  code: string
}

export function CodeBlock({ language = 'text', code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const theme = useThemeStore((s) => s.theme)
  const dark = isDarkTheme(theme)

  const cleanCode = (code || '').replace(/\n$/, '')
  const lang = (language || 'code').trim().toLowerCase()
  const displayLang = (lang || 'TEXT').toUpperCase()

  function handleCopy() {
    navigator.clipboard.writeText(cleanCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      style={{
        margin: '12px 0',
        borderRadius: 10,
        overflow: 'hidden',
        border: dark ? '1px solid #38332B' : '1px solid #EAE3D8',
        backgroundColor: dark ? '#1A1815' : '#FAF8F5',
        boxShadow: '0 2px 6px rgba(40,25,10,0.03)',
      }}
    >
      {/* Code Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          backgroundColor: dark ? '#141210' : '#F3EEE5',
          borderBottom: dark ? '1px solid #2C2822' : '1px solid #EAE3D8',
          fontSize: 11,
          fontFamily: 'var(--font-mono, monospace)',
          fontWeight: 700,
          color: dark ? '#A89E92' : '#6E6254',
          letterSpacing: '0.04em',
        }}
      >
        <span>{displayLang}</span>

        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 8px',
            borderRadius: 4,
            color: dark ? '#C2B8AC' : '#5C5245',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {copied ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>

      {/* Code Content Area */}
      <div style={{ overflowX: 'auto', padding: '12px 16px', fontSize: 12.5, lineHeight: 1.55 }}>
        <SyntaxHighlighter
          language={lang || 'text'}
          style={dark ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: 12.5,
            lineHeight: 1.55,
            fontFamily: 'var(--font-mono, monospace)',
          }}
          wrapLongLines={false}
        >
          {cleanCode}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
