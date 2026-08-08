import path from 'node:path'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import zlib from 'node:zlib'
import { createRequire } from 'node:module'
import { getWorkspaceRoot } from './filesystem.channel'

const reqModule = createRequire(import.meta.url)

export interface DocumentConversionRequest {
  filePath?: string
  buffer?: Uint8Array | ArrayBuffer | Buffer | unknown
  base64?: string
  fileName?: string
}

export interface ExtractedImage {
  mediaType: string
  base64: string
}

export interface DocumentConversionResult {
  ok: boolean
  markdown: string
  images: ExtractedImage[]
  format?: string
  error?: string
}

const SUPPORTED_DOC_EXTS = new Set([
  'doc', 'docx', 'docm',
  'ppt', 'pptx', 'pptm', 'pps', 'pot', 'ppsx', 'ppsm',
  'xls', 'xlsx', 'xlsm', 'xlsb',
  'odt', 'ods', 'odp',
  'rtf', 'epub', 'csv', 'pdf', 'txt', 'json', 'md',
])

// Global cache for attachments uploaded via chat UI
const ATTACHMENT_CACHE = new Map<string, string>()

export function cacheAttachmentContent(fileName: string, markdown: string) {
  if (!fileName || !markdown) return
  const cleanName = path.basename(fileName).toLowerCase().trim()
  ATTACHMENT_CACHE.set(cleanName, markdown)
  ATTACHMENT_CACHE.set(`[documento: ${cleanName}]`, markdown)
  ATTACHMENT_CACHE.set(`[archivo: ${cleanName}]`, markdown)
}

export function getCachedAttachmentContent(fileNameOrPath: string): string | null {
  if (!fileNameOrPath) return null
  const raw = String(fileNameOrPath).trim().toLowerCase()

  // 1. Direct match
  if (ATTACHMENT_CACHE.has(raw)) {
    return ATTACHMENT_CACHE.get(raw)!
  }

  // 2. Strip bracket prefix wrappers like [Documento: filename.pdf]
  let cleanName = raw.replace(/^\[(?:documento|archivo|documento pdf):\s*/i, '').replace(/\]$/, '').trim()
  cleanName = path.basename(cleanName).trim()

  if (ATTACHMENT_CACHE.has(cleanName)) {
    return ATTACHMENT_CACHE.get(cleanName)!
  }

  // 3. Substring / fuzzy match on keys
  for (const [cachedKey, content] of ATTACHMENT_CACHE.entries()) {
    const normKey = cachedKey.replace(/^\[(?:documento|archivo|documento pdf):\s*/i, '').replace(/\]$/, '').trim()
    if (cleanName.includes(normKey) || normKey.includes(cleanName)) {
      return content
    }
  }

  return null
}

export function isDocumentConvertible(fileNameOrPath: string): boolean {
  const ext = fileNameOrPath.split('.').pop()?.toLowerCase() ?? ''
  return SUPPORTED_DOC_EXTS.has(ext)
}

function parseTextFromDecompressedStream(streamStr: unknown, textChunks: string[]) {
  if (typeof streamStr !== 'string' || !streamStr) return

  // Match (Text) Tj or (Text) TJ
  const tjRegex = /\(([\s\S]*?)\)\s*(?:Tj|TJ)/g
  let match: RegExpExecArray | null
  while ((match = tjRegex.exec(streamStr)) !== null) {
    const raw = String(match[1] || '')
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
    const cleaned = raw.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u024F\u0400-\u04FF\u0600-\u06FF]/g, ' ').trim()
    if (cleaned.length > 1 && !textChunks.includes(cleaned)) {
      textChunks.push(cleaned)
    }
  }

  // Match array of strings: [(text) 10 (string)] TJ
  const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g
  while ((match = tjArrayRegex.exec(streamStr)) !== null) {
    const inner = String(match[1] || '')
    const innerTj = /\(([\s\S]*?)\)/g
    let subMatch: RegExpExecArray | null
    let piece = ''
    while ((subMatch = innerTj.exec(inner)) !== null) {
      piece += String(subMatch[1] || '').replace(/\\([()\\])/g, '$1')
    }
    const cleaned = piece.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u024F\u0400-\u04FF\u0600-\u06FF]/g, ' ').trim()
    if (cleaned.length > 1 && !textChunks.includes(cleaned)) {
      textChunks.push(cleaned)
    }
  }
}

function formatPdfExtractedText(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return ''
  let text = String(raw).trim()

  text = text.replace(/(\b\d{7,8}\s+[A-Z0-9\s]{3,40}\b)/g, '\n\n### 📌 $1\n')
  text = text.replace(/(\b(?:Docente|Aula|Horario|Sede|Programa|Nivel|Creditos|Intensidad|Grupo)\s*:?\b)/gi, '\n- **$1**')
  text = text.replace(/(\b(?:Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado|Domingo)\b)/g, '\n  - 🗓️ $1')

  return text.trim()
}

function extractPdfFallbackText(buf: Buffer): string {
  try {
    const textChunks: string[] = []
    const str = buf.toString('binary')

    // 1. Decompress FlateDecode streams
    const streamRegex = /\/Filter\s*(?:\[\s*\/FlateDecode\s*\]|\/FlateDecode)[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g
    let streamMatch: RegExpExecArray | null
    while ((streamMatch = streamRegex.exec(str)) !== null) {
      try {
        const streamStart = streamMatch.index + streamMatch[0].indexOf('stream')
        let dataStart = streamStart + 6
        if (buf[dataStart] === 13 && buf[dataStart + 1] === 10) dataStart += 2
        else if (buf[dataStart] === 10 || buf[dataStart] === 13) dataStart += 1

        const endMarker = buf.indexOf('endstream', dataStart)
        if (endMarker > dataStart) {
          let compressedSlice = buf.subarray(dataStart, endMarker)
          if (compressedSlice[compressedSlice.length - 1] === 10) compressedSlice = compressedSlice.subarray(0, compressedSlice.length - 1)
          if (compressedSlice[compressedSlice.length - 1] === 13) compressedSlice = compressedSlice.subarray(0, compressedSlice.length - 1)

          let decompressed: Buffer | null = null
          try {
            decompressed = zlib.inflateSync(compressedSlice)
          } catch {
            try {
              decompressed = zlib.unzipSync(compressedSlice)
            } catch {
              try {
                decompressed = zlib.inflateRawSync(compressedSlice)
              } catch { /* ignore */ }
            }
          }

          if (decompressed) {
            parseTextFromDecompressedStream(decompressed.toString('utf-8'), textChunks)
          }
        }
      } catch { /* ignore individual stream errors */ }
    }

    // 2. Also parse uncompressed text streams from raw binary string
    parseTextFromDecompressedStream(str, textChunks)

    // Deduplicate and filter chunks
    const unique = Array.from(new Set(textChunks)).filter(t => typeof t === 'string' && typeof t.trim === 'function' && t.trim().length > 1)
    return formatPdfExtractedText(unique.join('\n'))
  } catch {
    return ''
  }
}

function toSafeString(val: unknown): string {
  if (typeof val === 'string') return val
  if (Buffer.isBuffer(val)) return val.toString('utf-8')
  if (val instanceof Uint8Array) return Buffer.from(val).toString('utf-8')
  if (val instanceof Promise || (typeof val === 'object' && val !== null && typeof (val as any).then === 'function')) {
    console.warn('[toSafeString] Warning: received un-awaited Promise object')
    return ''
  }
  if (val != null) return String(val)
  return ''
}

export function parseBufferFromReq(req: DocumentConversionRequest): Buffer | null {
  if (req.base64 && typeof req.base64 === 'string') {
    try {
      const b = Buffer.from(req.base64, 'base64')
      if (b.length > 0) return b
    } catch { /* fallback */ }
  }

  const raw = req.buffer as any
  if (!raw) return null

  if (Buffer.isBuffer(raw)) return raw
  if (raw instanceof ArrayBuffer) return Buffer.from(raw)
  if (ArrayBuffer.isView(raw)) {
    return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength)
  }

  if (raw.data && (Array.isArray(raw.data) || ArrayBuffer.isView(raw.data))) {
    return Buffer.from(raw.data)
  }

  if (Array.isArray(raw)) {
    return Buffer.from(raw)
  }

  if (typeof raw === 'object') {
    const vals = Object.values(raw).filter((v): v is number => typeof v === 'number')
    if (vals.length > 0) return Buffer.from(vals)
  }

  return null
}

export async function convertDocumentToMarkdown(
  req: DocumentConversionRequest,
): Promise<DocumentConversionResult> {
  const fileName = req.fileName || (req.filePath ? path.basename(req.filePath) : 'documento')
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''

  let buf: Buffer | null = parseBufferFromReq(req)
  let markdown = ''
  let detectedFormat = ext
  const images: ExtractedImage[] = []

  // Check cache first
  const cached = getCachedAttachmentContent(fileName)
  if (cached && cached.trim()) {
    return {
      ok: true,
      markdown: cached,
      images: [],
      format: ext,
    }
  }

  try {
    if ((!buf || buf.length === 0) && req.filePath) {
      let resolvedPath = path.resolve(req.filePath)
      if (!fs.existsSync(resolvedPath)) {
        const root = getWorkspaceRoot()
        if (root) {
          const wsPath = path.join(root, req.filePath)
          if (fs.existsSync(wsPath)) resolvedPath = wsPath
        }
      }
      if (fs.existsSync(resolvedPath)) {
        buf = await fsPromises.readFile(resolvedPath)
      }
    }

    if (!buf || buf.length === 0) {
      return {
        ok: false,
        markdown: `[Error: No se pudo acceder al archivo ${fileName}]`,
        images: [],
        error: 'Missing or empty file buffer/path',
      }
    }

    // 1. Primary Engine: @firecrawl/anydoc (Async Rust NAPI bindings)
    try {
      const anydocPkg = ['@firecrawl', 'anydoc'].join('/')
      let anydoc: any
      try {
        anydoc = reqModule(anydocPkg)
      } catch {
        anydoc = await import(/* @vite-ignore */ anydocPkg)
      }

      if (anydoc) {
        if (typeof anydoc.formatFromBytes === 'function') {
          try {
            const fmt = await anydoc.formatFromBytes(buf)
            if (fmt) detectedFormat = String(fmt).toLowerCase()
          } catch { /* ignore */ }
        }

        // PDF requires toMarkdownBytes in @firecrawl/anydoc (which returns Promise<Uint8Array | string>)
        if ((ext === 'pdf' || detectedFormat === 'pdf') && typeof anydoc.toMarkdownBytes === 'function') {
          try {
            const rawBytes = await anydoc.toMarkdownBytes(buf)
            markdown = toSafeString(rawBytes)
          } catch (pdfErr) {
            console.warn('[document.channel] anydoc toMarkdownBytes pdf warning:', pdfErr)
          }
        }

        if (!markdown && typeof anydoc.toDocument === 'function') {
          try {
            const doc = await anydoc.toDocument(buf)
            if (doc) {
              if (typeof doc.toMarkdown === 'function') {
                markdown = toSafeString(await doc.toMarkdown())
              } else if (doc.blocks && Array.isArray(doc.blocks)) {
                markdown = doc.blocks.map((b: any) => toSafeString(b.text || b.content)).filter(Boolean).join('\n\n')
              }

              if (doc.assets && Array.isArray(doc.assets)) {
                for (const asset of doc.assets) {
                  if (asset.data && asset.mediaType) {
                    const b64 = Buffer.isBuffer(asset.data)
                      ? asset.data.toString('base64')
                      : (asset.data instanceof Uint8Array ? Buffer.from(asset.data).toString('base64') : '')
                    if (b64) {
                      images.push({
                        mediaType: asset.mediaType || 'image/png',
                        base64: b64,
                      })
                    }
                  }
                }
              }
            }
          } catch (docErr) {
            console.warn('[document.channel] anydoc toDocument warning:', docErr)
          }
        } else if (!markdown && typeof anydoc.toMarkdownBytes === 'function') {
          try {
            markdown = toSafeString(await anydoc.toMarkdownBytes(buf))
          } catch { /* ignore */ }
        }
      }
    } catch (anydocErr) {
      console.warn('[document.channel] anydoc conversion warning:', anydocErr)
    }

    markdown = toSafeString(markdown)

    // 2. Fallback Engine for PDFs if anydoc returned empty or threw
    if ((!markdown || !markdown.trim()) && (ext === 'pdf' || detectedFormat === 'pdf')) {
      const pdfText = extractPdfFallbackText(buf)
      if (pdfText && pdfText.trim()) {
        markdown = `[Documento PDF: ${fileName}]\n\n${pdfText}`
      }
    }

    // 3. Fallback Engine for Plain Text / CSV / JSON
    if (!markdown || !markdown.trim()) {
      if (buf && ['txt', 'csv', 'json', 'md', 'rtf'].includes(ext)) {
        markdown = buf.toString('utf-8')
      }
    }

    if (!markdown || !markdown.trim()) {
      markdown = `[Documento procesado (${fileName}) — Sin contenido de texto extraíble]`
    }

    // Cache successful conversion
    cacheAttachmentContent(fileName, markdown)

    return {
      ok: true,
      markdown,
      images,
      format: detectedFormat,
    }
  } catch (err: any) {
    console.error('[document.channel] Error processing document:', err)
    const code = err?.code || err?.message || ''
    let friendlyError = `[Error al leer documento ${fileName}: ${err?.message || String(err)}]`

    if (String(code).includes('encrypted') || String(err).includes('encrypted')) {
      friendlyError = `[Documento protegido con contraseña, no se pudo leer: ${fileName}]`
    } else if (String(code).includes('malformed') || String(err).includes('malformed')) {
      friendlyError = `[No se pudo leer el contenido, el archivo parece dañado: ${fileName}]`
    } else if (String(code).includes('unsupported') || String(err).includes('unsupported')) {
      friendlyError = `[Formato de documento no soportado para lectura de contenido: ${fileName}]`
    }

    return {
      ok: false,
      markdown: friendlyError,
      images: [],
      error: String(err),
    }
  }
}
