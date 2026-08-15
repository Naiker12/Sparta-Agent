import type { MouseEvent, ReactNode } from 'react'
import { Streamdown, type Components } from 'streamdown'
import { createCodePlugin } from '@streamdown/code'
import { createMathPlugin } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import { openExternal } from 'ia-sparta-core'
import 'katex/dist/katex.min.css'

interface MarkdownTextProps {
  content: string
  isStreaming?: boolean
}

const code = createCodePlugin({ themes: ['github-light', 'github-dark'] })
const math = createMathPlugin({ singleDollarTextMath: true })

const MENTION_REGEX = /(@(?:OneDrive \/ SharePoint|Google Drive|Filesystem|Gmail|Google Calendar|Supabase|DBHub|MongoDB|Notion|Slack|Figma|Stripe|Sentry|Playwright|Chrome DevTools|Memory|Fetch|git|github|\w+))/gi

function highlightMentions(text: string): ReactNode {
  if (!text.includes('@')) return text

  const parts = text.split(MENTION_REGEX)
  if (parts.length <= 1) return text

  return parts.map((part, index) => part.startsWith('@') ? (
    <span className="md-mention" key={`${part}-${index}`}>{part}</span>
  ) : part)
}

function processChildren(children: ReactNode): ReactNode {
  if (typeof children === 'string') return highlightMentions(children)
  if (!Array.isArray(children)) return children

  return children.map((child, index) => (
    typeof child === 'string'
      ? <span key={index}>{highlightMentions(child)}</span>
      : child
  ))
}

function handleLinkClick(event: MouseEvent<HTMLAnchorElement>, href?: string) {
  if (!href || !/^https?:\/\//.test(href)) return
  event.preventDefault()
  openExternal(href)
}

const components: Components = {
  p: ({ children, node: _node, ...props }) => <p className="md-p" {...props}>{processChildren(children)}</p>,
  li: ({ children, node: _node, ...props }) => <li className="md-li" {...props}>{processChildren(children)}</li>,
  a: ({ children, href, node: _node, ...props }) => (
    <a className="md-link" href={href} onClick={(event) => handleLinkClick(event, href)} {...props}>
      {children}
    </a>
  ),
  img: ({ alt = '', node: _node, ...props }) => <img alt={alt} className="md-image" loading="lazy" {...props} />,
  table: ({ children, node: _node, ...props }) => (
    <div className="md-table-wrapper">
      <table className="md-table" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, node: _node, ...props }) => <th className="md-th" {...props}>{children}</th>,
  td: ({ children, node: _node, ...props }) => <td className="md-td" {...props}>{children}</td>,
}

export function MarkdownText({ content, isStreaming = false }: MarkdownTextProps) {
  return (
    <Streamdown
      animated={isStreaming ? { animation: 'fadeIn', duration: 120, sep: 'word', stagger: 0.015 } : false}
      className="markdown-body"
      components={components}
      isAnimating={isStreaming}
      mode={isStreaming ? 'streaming' : 'static'}
      plugins={{ code, math, mermaid }}
      shikiTheme={['github-light', 'github-dark']}
    >
      {content}
    </Streamdown>
  )
}
