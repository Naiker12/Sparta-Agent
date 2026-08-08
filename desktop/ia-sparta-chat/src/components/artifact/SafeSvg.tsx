import { useMemo } from 'react'

interface SafeSvgProps {
  content: string
  className?: string
}

function sanitizeSvg(raw: string): string | null {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i)
  if (!match) return null
  let svg = match[0]
  // Strip <script> and <foreignObject> elements
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '')
  svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
  // Strip event handler attributes (on*)
  svg = svg.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
  // Strip javascript: URLs in href/xlink:href
  svg = svg.replace(/(href\s*=\s*["'])javascript:[^"']*(["'])/gi, '$1#$2')
  return svg
}

export function SafeSvg({ content, className }: SafeSvgProps) {
  const sanitized = useMemo(() => sanitizeSvg(content), [content])

  if (!sanitized) return <span className={className} style={{ color: 'var(--text-danger)' }}>SVG inválido</span>

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    />
  )
}
