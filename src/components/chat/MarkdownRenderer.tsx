import { useState, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { useThemeStore, isDarkTheme } from '@/stores/theme.store'
import type { Components } from 'react-markdown'

interface MarkdownRendererProps {
  content: string
  isStreaming?: boolean
}

function looksLikeOpenTableOrList(tail: string): boolean {
  const lines = tail.split('\n')
  if (lines.length === 0) return false
  // Table: at least one line with pipe-delimited cells.
  const hasTableRow = lines.some((l) => /^\s*\|.*\|\s*$/.test(l))
  // List: at least one line starting with a bullet or ordered marker.
  const listLineRe = /^\s*([-*]|\d+\.)\s+/
  const hasListLine = lines.some((l) => listLineRe.test(l))
  return hasTableRow || hasListLine
}

function splitStableMarkdown(content: string): { stable: string; pending: string } {
  // Do not split while we are inside an open code block; otherwise the trailing
  // backticks remain visible as raw text until the block closes.
  const codeBlockCount = (content.match(/```/g) || []).length
  if (codeBlockCount % 2 !== 0) {
    return { stable: '', pending: content }
  }

  // Walk paragraph boundaries backwards until the tail is not an open
  // table or list. This prevents tables/lists from being rendered as plain
  // text while the model is still adding rows/items.
  let searchFrom = content.length
  while (true) {
    const boundary = content.lastIndexOf('\n\n', searchFrom - 1)
    if (boundary === -1) return { stable: '', pending: content }
    const tail = content.slice(boundary + 2)
    if (!looksLikeOpenTableOrList(tail)) {
      return { stable: content.slice(0, boundary), pending: tail }
    }
    searchFrom = boundary
  }
}

function splitPendingFence(content: string): { before: string; language: string; code: string } | null {
  const fences = [...content.matchAll(/^```([A-Za-z0-9_-]*)[^\n]*\n?/gm)]
  if (fences.length % 2 === 0) return null
  const opening = fences[fences.length - 1]
  if (opening.index === undefined) return null
  return {
    before: content.slice(0, opening.index),
    language: opening[1] || 'text',
    code: content.slice(opening.index + opening[0].length),
  }
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

const cleanSyntaxStyle = (style: any) => {
  if (!style) return style
  const cleaned = { ...style }
  for (const key in cleaned) {
    if (
      key.includes('pre') ||
      key.includes('code') ||
      key === 'pre[class*="language-"]' ||
      key === 'code[class*="language-"]'
    ) {
      if (cleaned[key]) {
        cleaned[key] = {
          ...cleaned[key],
          background: 'transparent',
          backgroundColor: 'transparent',
        }
      }
    }
  }
  return cleaned
}

function makeMarkdownComponents(syntaxStyle: any): Components {
  return {
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
            codeTagProps={{
              style: {
                background: 'transparent',
                backgroundColor: 'transparent',
                fontFamily: 'inherit',
              }
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
  }
}

const StableMarkdown = memo(function StableMarkdown({ content, components }: { content: string; components: Components }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>
}, (prev, next) => prev.content === next.content)

export function MarkdownRenderer({ content, isStreaming }: MarkdownRendererProps) {
  const { theme } = useThemeStore()
  const rawStyle = isDarkTheme(theme) ? oneDark : oneLight
  const syntaxStyle = cleanSyntaxStyle(rawStyle)
  const components = makeMarkdownComponents(syntaxStyle)

  const { stable, pending } = isStreaming ? splitStableMarkdown(content) : { stable: content, pending: '' }
  const pendingFence = isStreaming ? splitPendingFence(pending) : null
  const pendingAsMarkdown = isStreaming && pending && !pendingFence && looksLikeOpenTableOrList(pending)

  return (
    <div className="markdown-body">
      {stable && <StableMarkdown content={stable} components={components} />}
      {isStreaming && pendingFence && (
        <>
          {pendingFence.before && (
            <span style={{ whiteSpace: 'pre-wrap' }}>{pendingFence.before}</span>
          )}
          <div className="md-code-block">
            <div className="md-code-header">
              <span className="md-code-lang">{pendingFence.language}</span>
              <CopyCodeButton code={pendingFence.code} />
            </div>
            <pre
              style={{
                margin: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: '12.5px',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--text-primary)',
              }}
            >
              {pendingFence.code}
            </pre>
          </div>
        </>
      )}
      {pendingAsMarkdown ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {pending}
        </ReactMarkdown>
      ) : (
        isStreaming && pending && !pendingFence && (
          <span style={{ whiteSpace: 'pre-wrap' }}>{pending}</span>
        )
      )}
    </div>
  )
}
