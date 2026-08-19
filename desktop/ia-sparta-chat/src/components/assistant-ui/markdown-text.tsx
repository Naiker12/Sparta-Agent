import { useMemo } from 'react'
import type { ReactNode, MouseEvent } from 'react'
import { openExternal } from 'ia-sparta-core'
import { CodeBlock } from './CodeBlock'

interface MarkdownTextProps {
  content: string
  isStreaming?: boolean
}

function handleLinkClick(event: MouseEvent<HTMLAnchorElement>, href?: string) {
  if (!href || !/^https?:\/\//.test(href)) return
  event.preventDefault()
  openExternal(href)
}

function parseInlineFormatting(text: string): ReactNode[] {
  if (!text) return []

  // Tokenize bold, italic, code, link, mentions
  const tokens: ReactNode[] = []
  // Matches: `code`, **bold**, *italic*, [link](url), @mention
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|@(?:OneDrive \/ SharePoint|Google Drive|Filesystem|Gmail|Google Calendar|Supabase|DBHub|MongoDB|Notion|Slack|Figma|Stripe|Sentry|Playwright|Chrome DevTools|Memory|Fetch|git|github|\w+))/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    const key = `tok-${match.index}`

    if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={key}
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.88em',
            padding: '2px 5px',
            borderRadius: 4,
            backgroundColor: '#F2EDE4',
            color: '#1C1713',
            border: '1px solid #E5DEC9',
          }}
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={key} style={{ fontWeight: 700, color: '#1C1713' }}>
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(<em key={key}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const linkText = token.slice(1, token.indexOf(']('))
      const url = token.slice(token.indexOf('](') + 2, -1)
      tokens.push(
        <a
          key={key}
          href={url}
          onClick={(e) => handleLinkClick(e, url)}
          style={{
            color: '#10B981',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {linkText}
        </a>
      )
    } else if (token.startsWith('@')) {
      tokens.push(
        <span
          key={key}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 6px',
            borderRadius: 4,
            backgroundColor: '#DCFCE7',
            color: '#166534',
            fontSize: '0.88em',
            fontWeight: 700,
            margin: '0 2px',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {token}
        </span>
      )
    } else {
      tokens.push(token)
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex))
  }

  return tokens
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  const rawCells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|')
  return rawCells.map((c) => c.trim())
}

function isTableSeparator(line: string): boolean {
  const cells = parseTableRow(line)
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c))
}

export function MarkdownText({ content }: MarkdownTextProps) {
  const blocks = useMemo(() => {
    if (!content) return []

    // 1. Normalize linebreaks for table rows concatenated on single lines
    const normalized = content.replace(/\|\s*\|/g, '|\n|')

    const result: ReactNode[] = []
    const lines = normalized.split('\n')

    let inCodeBlock = false
    let codeLanguage = ''
    let codeBuffer: string[] = []
    let textBuffer: string[] = []
    let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null
    let tableBuffer: string[] = []

    function flushList() {
      if (!listBuffer) return
      const ListTag = listBuffer.type
      const currentList = listBuffer
      result.push(
        <ListTag
          key={`list-${result.length}`}
          style={{
            paddingLeft: 22,
            margin: '8px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 13,
            lineHeight: 1.5,
            color: '#2A241E',
          }}
        >
          {currentList.items.map((item, idx) => (
            <li key={idx} style={{ margin: 0 }}>
              {parseInlineFormatting(item)}
            </li>
          ))}
        </ListTag>
      )
      listBuffer = null
    }

    function flushTable() {
      if (tableBuffer.length === 0) return
      const rows = tableBuffer
      tableBuffer = []

      // Separate header from rows
      let headerCells: string[] = []
      let bodyRows: string[][] = []

      if (rows.length >= 2 && isTableSeparator(rows[1])) {
        headerCells = parseTableRow(rows[0])
        bodyRows = rows.slice(2).map(parseTableRow)
      } else if (rows.length >= 1) {
        headerCells = parseTableRow(rows[0])
        bodyRows = rows.slice(1).map(parseTableRow)
      }

      if (headerCells.length > 0) {
        result.push(
          <div
            key={`table-${result.length}`}
            style={{
              margin: '14px 0',
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid #EAE3D8',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 6px rgba(40,25,10,0.03)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid #EAE3D8' }}>
                  <tr>
                    {headerCells.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        style={{
                          padding: '8px 14px',
                          fontWeight: 700,
                          color: '#1C1713',
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: 11.5,
                          letterSpacing: '0.03em',
                          borderRight: hIdx < headerCells.length - 1 ? '1px solid #F0ECE4' : 'none',
                        }}
                      >
                        {parseInlineFormatting(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        backgroundColor: rIdx % 2 === 0 ? '#FFFFFF' : '#FAF8F5',
                        borderBottom: rIdx < bodyRows.length - 1 ? '1px solid #F0ECE4' : 'none',
                      }}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          style={{
                            padding: '8px 14px',
                            color: '#383028',
                            lineHeight: 1.45,
                            borderRight: cIdx < row.length - 1 ? '1px solid #F5EFE6' : 'none',
                          }}
                        >
                          {parseInlineFormatting(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    }

    function flushText() {
      if (textBuffer.length === 0) return
      flushList()
      flushTable()
      const text = textBuffer.join('\n').trim()
      if (text) {
        // Special Callout for "Nota:"
        if (text.startsWith('Nota:') || text.startsWith('**Nota:**') || text.startsWith('Note:')) {
          result.push(
            <div
              key={`callout-${result.length}`}
              style={{
                margin: '12px 0',
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderLeft: '4px solid #10B981',
                fontSize: 12.5,
                lineHeight: 1.5,
                color: '#14532D',
              }}
            >
              {parseInlineFormatting(text)}
            </div>
          )
        } else {
          result.push(
            <p
              key={`p-${result.length}`}
              style={{
                margin: '6px 0',
                fontSize: 13.5,
                lineHeight: 1.6,
                color: '#2A241E',
              }}
            >
              {parseInlineFormatting(text)}
            </p>
          )
        }
      }
      textBuffer = []
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // Code block boundary
      if (trimmed.startsWith('```')) {
        if (!inCodeBlock) {
          flushText()
          flushList()
          flushTable()
          inCodeBlock = true
          codeLanguage = trimmed.replace(/^```/, '').trim()
          codeBuffer = []
        } else {
          inCodeBlock = false
          result.push(
            <CodeBlock
              key={`code-${result.length}`}
              language={codeLanguage}
              code={codeBuffer.join('\n')}
            />
          )
          codeBuffer = []
          codeLanguage = ''
        }
        continue
      }

      if (inCodeBlock) {
        codeBuffer.push(line)
        continue
      }

      // Horizontal rules
      if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        flushText()
        flushList()
        flushTable()
        result.push(
          <hr
            key={`hr-${result.length}`}
            style={{ border: 'none', borderTop: '1px solid #EAE3D8', margin: '14px 0' }}
          />
        )
        continue
      }

      // Markdown Table row
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
        flushText()
        flushList()
        tableBuffer.push(trimmed)
        continue
      } else if (tableBuffer.length > 0) {
        flushTable()
      }

      // Headings
      if (line.startsWith('### ')) {
        flushText()
        flushList()
        flushTable()
        result.push(
          <h3
            key={`h3-${result.length}`}
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#1C1713',
              margin: '14px 0 6px 0',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
              letterSpacing: '-0.01em',
            }}
          >
            {parseInlineFormatting(line.slice(4))}
          </h3>
        )
        continue
      }

      if (line.startsWith('## ')) {
        flushText()
        flushList()
        flushTable()
        result.push(
          <h2
            key={`h2-${result.length}`}
            style={{
              fontSize: 15.5,
              fontWeight: 800,
              color: '#1C1713',
              margin: '16px 0 8px 0',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
            }}
          >
            {parseInlineFormatting(line.slice(3))}
          </h2>
        )
        continue
      }

      if (line.startsWith('# ')) {
        flushText()
        flushList()
        flushTable()
        result.push(
          <h1
            key={`h1-${result.length}`}
            style={{
              fontSize: 17,
              fontWeight: 900,
              color: '#1C1713',
              margin: '18px 0 10px 0',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
            }}
          >
            {parseInlineFormatting(line.slice(2))}
          </h1>
        )
        continue
      }

      // Unordered list item
      if (/^\s*[-*]\s+/.test(line)) {
        flushText()
        flushTable()
        const itemContent = line.replace(/^\s*[-*]\s+/, '')
        if (!listBuffer || listBuffer.type !== 'ul') {
          flushList()
          listBuffer = { type: 'ul', items: [] }
        }
        listBuffer.items.push(itemContent)
        continue
      }

      // Ordered list item
      if (/^\s*\d+\.\s+/.test(line)) {
        flushText()
        flushTable()
        const itemContent = line.replace(/^\s*\d+\.\s+/, '')
        if (!listBuffer || listBuffer.type !== 'ol') {
          flushList()
          listBuffer = { type: 'ol', items: [] }
        }
        listBuffer.items.push(itemContent)
        continue
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        flushText()
        flushList()
        flushTable()
        result.push(
          <blockquote
            key={`quote-${result.length}`}
            style={{
              margin: '8px 0',
              paddingLeft: 12,
              borderLeft: '3px solid #10B981',
              color: '#5C5245',
              fontStyle: 'italic',
              fontSize: 13,
            }}
          >
            {parseInlineFormatting(line.slice(2))}
          </blockquote>
        )
        continue
      }

      // Empty line -> flush paragraph
      if (!trimmed) {
        flushText()
        flushList()
        flushTable()
        continue
      }

      // Regular text line
      textBuffer.push(line)
    }

    // Flush any remaining
    if (inCodeBlock && codeBuffer.length > 0) {
      result.push(
        <CodeBlock
          key={`code-${result.length}`}
          language={codeLanguage}
          code={codeBuffer.join('\n')}
        />
      )
    } else {
      flushText()
      flushList()
      flushTable()
    }

    return result
  }, [content])

  return <div className="markdown-body">{blocks}</div>
}
