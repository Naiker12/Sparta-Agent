import { MarkdownRenderer } from '../MarkdownRenderer'
import { SyntaxHighlighterPreview } from './SyntaxHighlighterPreview'
import { SafeSvg } from './SafeSvg'
import { PdfViewer } from './PdfViewer'
import { SheetPreview } from './SheetPreview'

interface PreviewRendererProps {
  filePath: string
  content: string
  base64?: string
}

const EXT_PREVIEW: Record<string, 'md' | 'code' | 'svg' | 'pdf' | 'sheet' | 'image'> = {
  md: 'md', markdown: 'md',
  ts: 'code', tsx: 'code', js: 'code', jsx: 'code', json: 'code', py: 'code',
  rs: 'code', go: 'code', java: 'code', c: 'code', cpp: 'code', h: 'code',
  css: 'code', scss: 'code', html: 'code', xml: 'code', yaml: 'code', yml: 'code',
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

export function PreviewRenderer({ filePath, content, base64 }: PreviewRendererProps) {
  const ext = getExtension(filePath)
  const type = EXT_PREVIEW[ext]

  switch (type) {
    case 'md':
      return <MarkdownRenderer content={content} />
    case 'code':
      return <SyntaxHighlighterPreview code={content} fileName={filePath} />
    case 'svg':
      return <SafeSvg content={content} />
    case 'pdf':
      return <PdfViewer base64={base64 ?? ''} fileName={filePath} />
    case 'sheet':
      return <SheetPreview base64={base64 ?? ''} fileName={filePath} />
    case 'image':
      return <img src={`data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${base64 ?? ''}`} alt={filePath} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }} />
    default:
      return <SyntaxHighlighterPreview code={content} fileName={filePath} />
  }
}
