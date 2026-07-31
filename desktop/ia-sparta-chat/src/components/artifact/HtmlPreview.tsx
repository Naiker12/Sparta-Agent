import { useMemo } from 'react'

interface HtmlPreviewProps {
  content: string
}

export function HtmlPreview({ content }: HtmlPreviewProps) {
  const srcDoc = useMemo(() => {
    if (content.includes('<html') || content.includes('<DOCTYPE') || content.includes('<body')) {
      return content
    }
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; background: #ffffff; color: #111827; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`
  }, [content])

  return (
    <div style={{ width: '100%', height: '100%', background: '#ffffff', borderRadius: 0, overflow: 'hidden', border: 'none', margin: 0, padding: 0 }}>
      <iframe
        srcDoc={srcDoc}
        title="HTML Preview"
        sandbox="allow-scripts allow-modals allow-same-origin"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#ffffff',
          margin: 0,
          padding: 0,
          display: 'block',
        }}
      />
    </div>
  )
}
