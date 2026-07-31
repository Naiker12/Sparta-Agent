import { MarkdownRenderer } from '../MarkdownRenderer'
import { SyntaxHighlighterPreview } from './SyntaxHighlighterPreview'
import { SafeSvg } from './SafeSvg'
import { PdfViewer } from './PdfViewer'
import { SheetPreview } from './SheetPreview'
import { HtmlPreview } from './HtmlPreview'

interface PreviewRendererProps {
  filePath: string
  content: string
  base64?: string
  viewMode?: 'preview' | 'code'
}

const EXT_PREVIEW: Record<string, 'md' | 'code' | 'svg' | 'pdf' | 'sheet' | 'image' | 'html'> = {
  md: 'md', markdown: 'md',
  html: 'html', htm: 'html',
  ts: 'code', tsx: 'code', js: 'code', jsx: 'code', json: 'code', py: 'code',
  rs: 'code', go: 'code', java: 'code', c: 'code', cpp: 'code', h: 'code',
  css: 'code', scss: 'code', xml: 'code', yaml: 'code', yml: 'code',
  toml: 'code', sh: 'code', bash: 'code', sql: 'code', graphql: 'code',
  svg: 'svg',
  pdf: 'pdf',
  xlsx: 'sheet', xls: 'sheet', csv: 'sheet',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image',
}

function getExtension(path: string) {
  const lastDot = path.lastIndexOf('.')
  if (lastDot === -1) return ''
  return path.slice(lastDot + 1).toLowerCase()
}

export function PreviewRenderer({ filePath, content, base64, viewMode = 'preview' }: PreviewRendererProps) {
  const ext = getExtension(filePath)
  const type = EXT_PREVIEW[ext] ?? 'code'

  if (viewMode === 'code' && type !== 'pdf' && type !== 'image' && type !== 'sheet') {
    return <SyntaxHighlighterPreview code={content} fileName={filePath} />
  }

  switch (type) {
    case 'html':
      return <HtmlPreview content={content} />
    case 'md':
      return (
        <div style={{ padding: '20px', background: 'var(--bg-surface)', borderRadius: 0, height: '100%', overflow: 'auto' }}>
          <MarkdownRenderer content={content} />
        </div>
      )
    case 'code':
      return <SyntaxHighlighterPreview code={content} fileName={filePath} />
    case 'svg':
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-surface)', borderRadius: 0, padding: 20 }}>
          <SafeSvg content={content} />
        </div>
      )
    case 'pdf':
      return <PdfViewer base64={base64 ?? ''} fileName={filePath} />
    case 'sheet':
      return <SheetPreview base64={base64 ?? ''} fileName={filePath} />
    case 'image':
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 20 }}>
          <img src={`data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${base64 ?? ''}`} alt={filePath} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )
    default:
      return <SyntaxHighlighterPreview code={content} fileName={filePath} />
  }
}
