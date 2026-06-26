import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => href && handleLinkClick(e, href)}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
