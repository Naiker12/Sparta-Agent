import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { useThemeStore, isDarkTheme } from '@/stores/theme.store'

interface MarkdownRendererProps {
  content: string
}

function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (/^https?:\/\//.test(href)) {
    e.preventDefault()
    if (window.electron?.send) {
      window.electron.send('shell:open-external', href)
    } else {
      window.open(href, '_blank', 'noopener')
    }
  }
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10.5, color: 'var(--text-muted)',
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '2px 6px', borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-ui)',
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { theme } = useThemeStore()
  const syntaxStyle = isDarkTheme(theme) ? oneDark : oneLight

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="md-p">{children}</p>,
          ul: ({ children }) => <ul className="md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="md-ol">{children}</ol>,
          li: ({ children }) => <li className="md-li">{children}</li>,
          strong: ({ children }) => <strong className="md-strong">{children}</strong>,
          em: ({ children }) => <em className="md-em">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="md-link"
              onClick={(e) => href && handleLinkClick(e, href)}
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className ?? '')
            const raw = String(children)
            const isInline = !match && !raw.includes('\n')
            if (isInline) {
              return <code className="md-code-inline" {...props}>{children}</code>
            }
            const lang = match?.[1] ?? ''
            const code = raw.replace(/\n$/, '')
            return (
              <div className="md-code-block">
                <div className="md-code-header">
                  <span className="md-code-lang">{lang || 'code'}</span>
                  <CopyCodeButton code={code} />
                </div>
                <SyntaxHighlighter
                  language={lang || 'text'}
                  style={syntaxStyle}
                  customStyle={{
                    margin: 0,
                    border: 'none',
                    borderRadius: 0,
                    fontSize: '12.5px',
                    lineHeight: '1.55',
                    background: 'var(--bg-surface)',
                  }}
                  showLineNumbers={code.split('\n').length > 8}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            )
          },
          pre: ({ children }) => <>{children}</>,
          h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
          blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
          table: ({ children }) => (
            <div className="md-table-wrapper">
              <table className="md-table">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="md-th">{children}</th>,
          td: ({ children }) => <td className="md-td">{children}</td>,
          hr: () => <hr className="md-hr" />,
          del: ({ children }) => <del className="md-del">{children}</del>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
