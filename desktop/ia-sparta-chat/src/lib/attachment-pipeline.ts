export interface ProcessedAttachment {
  id: string
  fileName: string
  mimeType: string
  size: number
  kind: 'text' | 'image' | 'binary'
  previewText: string
  base64Data?: string
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(size => (size / (1024 * 1024)).toFixed(1))(bytes)} MB`
}

export function processFile(file: File): Promise<ProcessedAttachment> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const sizeStr = formatFileSize(file.size)
    const id = crypto.randomUUID()

    const isImage = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)
    const isBinaryDoc = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'zip', 'tar', 'gz', 'mp3', 'wav'].includes(ext)

    if (isImage) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        const base64Data = dataUrl ? dataUrl.split(',')[1] : undefined
        const mimeType = file.type || `image/${ext === 'svg' ? 'svg+xml' : ext}`

        resolve({
          id,
          fileName: file.name,
          mimeType,
          size: file.size,
          kind: 'image',
          previewText: `[Imagen adjunta: ${file.name} (${sizeStr})]`,
          base64Data,
        })
      }
      reader.onerror = (err) => reject(err)
      reader.readAsDataURL(file)
      return
    }

    if (isBinaryDoc) {
      resolve({
        id,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        kind: 'binary',
        previewText: `[Archivo binario adjunto: ${file.name} (${sizeStr}) - .${ext}]`,
      })
      return
    }

    // Text / Code / Data files
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = (ev.target?.result as string) || ''
      const maxLen = 4000
      const preview = content.slice(0, maxLen)
      const truncated = content.length > maxLen ? '\n_(contenido truncado)_' : ''
      const fileBlock = `[Archivo: ${file.name}]\n\`\`\`${ext}\n${preview}\n\`\`\`${truncated}`

      resolve({
        id,
        fileName: file.name,
        mimeType: file.type || 'text/plain',
        size: file.size,
        kind: 'text',
        previewText: fileBlock,
      })
    }
    reader.onerror = (err) => reject(err)
    reader.readAsText(file)
  })
}

function parseSizeStrToBytes(sizeStr: string): number {
  const clean = sizeStr.trim()
  if (clean.includes('MB')) return parseFloat(clean) * 1024 * 1024
  if (clean.includes('KB')) return parseFloat(clean) * 1024
  return parseFloat(clean) || 1024
}

export function parseUserMessageAttachments(content: string): {
  cleanText: string
  attachments: ProcessedAttachment[]
} {
  if (!content) return { cleanText: '', attachments: [] }

  const attachments: ProcessedAttachment[] = []
  let cleanText = content

  // Match [Archivo binario adjunto: filename (size) - .ext]
  const binaryRegex = /\[Archivo binario adjunto:\s*([^\(]+)\s*\(([^)]+)\)\s*-\s*\.([^\]]+)\]/g
  let match: RegExpExecArray | null
  while ((match = binaryRegex.exec(content)) !== null) {
    const fileName = match[1].trim()
    const sizeStr = match[2].trim()
    attachments.push({
      id: crypto.randomUUID(),
      fileName,
      mimeType: 'application/octet-stream',
      size: parseSizeStrToBytes(sizeStr),
      kind: 'binary',
      previewText: match[0],
    })
  }
  cleanText = cleanText.replace(binaryRegex, '').trim()

  // Match [Imagen adjunta: filename (size)]
  const imageRegex = /\[Imagen adjunta:\s*([^\(]+)\s*\(([^)]+)\)\]/g
  while ((match = imageRegex.exec(content)) !== null) {
    const fileName = match[1].trim()
    const sizeStr = match[2].trim()
    attachments.push({
      id: crypto.randomUUID(),
      fileName,
      mimeType: 'image/png',
      size: parseSizeStrToBytes(sizeStr),
      kind: 'image',
      previewText: match[0],
    })
  }
  cleanText = cleanText.replace(imageRegex, '').trim()

  // Match [Archivo: filename]
  const codeFileRegex = /\[Archivo:\s*([^\]]+)\]\n```[a-zA-Z0-9_-]*\n[\s\S]*?```(?:\n_\(contenido truncado\)_)?/g
  while ((match = codeFileRegex.exec(content)) !== null) {
    const fileName = match[1].trim()
    attachments.push({
      id: crypto.randomUUID(),
      fileName,
      mimeType: 'text/plain',
      size: 1024,
      kind: 'text',
      previewText: match[0],
    })
  }
  cleanText = cleanText.replace(codeFileRegex, '').trim()

  return { cleanText, attachments }
}
