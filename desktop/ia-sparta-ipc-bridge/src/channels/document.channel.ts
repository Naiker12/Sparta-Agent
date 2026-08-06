import path from 'node:path'
import fsPromises from 'node:fs/promises'
import { createRequire } from 'node:module'

const reqModule = createRequire(import.meta.url)

export interface DocumentConversionRequest {
  filePath?: string
  buffer?: Uint8Array | ArrayBuffer | Buffer
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
  'rtf', 'epub', 'csv', 'pdf',
])

export function isDocumentConvertible(fileNameOrPath: string): boolean {
  const ext = fileNameOrPath.split('.').pop()?.toLowerCase() ?? ''
  return SUPPORTED_DOC_EXTS.has(ext)
}

export async function convertDocumentToMarkdown(
  req: DocumentConversionRequest,
): Promise<DocumentConversionResult> {
  const fileName = req.fileName || (req.filePath ? path.basename(req.filePath) : 'documento')
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''

  try {
    let buf: Buffer
    if (req.buffer) {
      buf = Buffer.from(req.buffer as any)
    } else if (req.filePath) {
      buf = await fsPromises.readFile(req.filePath)
    } else {
      return {
        ok: false,
        markdown: `[Error: No se proporcionó ruta ni buffer para el archivo ${fileName}]`,
        images: [],
        error: 'Missing file input',
      }
    }

    // Try loading @firecrawl/anydoc dynamically
    let anydoc: any
    const anydocPkg = ['@firecrawl', 'anydoc'].join('/')
    try {
      anydoc = reqModule(anydocPkg)
    } catch {
      try {
        anydoc = await import(/* @vite-ignore */ anydocPkg)
      } catch (e: any) {
        return {
          ok: false,
          markdown: `[No se pudo cargar el motor anydoc para procesar ${fileName}]`,
          images: [],
          error: String(e?.message || e),
        }
      }
    }

    // Format detection or fallback from extension
    let detectedFormat: string = ext
    if (typeof anydoc.formatFromBytes === 'function') {
      try {
        const fmt = anydoc.formatFromBytes(buf)
        if (fmt) detectedFormat = String(fmt).toLowerCase()
      } catch { /* use extension */ }
    }

    const images: ExtractedImage[] = []
    let markdown = ''

    // PDF handles toMarkdown / toMarkdownBytes in anydoc
    if (detectedFormat === 'pdf' || ext === 'pdf') {
      if (typeof anydoc.toMarkdownBytes === 'function') {
        markdown = anydoc.toMarkdownBytes(buf)
      } else if (typeof anydoc.toMarkdown === 'function' && req.filePath) {
        markdown = anydoc.toMarkdown(req.filePath)
      } else {
        markdown = `[Documento PDF adjunto: ${fileName}]`
      }
    } else if (typeof anydoc.toDocument === 'function') {
      const doc = anydoc.toDocument(buf)
      if (doc) {
        if (typeof doc.toMarkdown === 'function') {
          markdown = doc.toMarkdown()
        } else if (doc.blocks && Array.isArray(doc.blocks)) {
          markdown = doc.blocks.map((b: any) => b.text || b.content || '').filter(Boolean).join('\n\n')
        }

        // Extract embedded image assets
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
    } else if (typeof anydoc.toMarkdownBytes === 'function') {
      markdown = anydoc.toMarkdownBytes(buf)
    }

    if (!markdown || !markdown.trim()) {
      markdown = `[Documento procesado (${fileName}) — Sin contenido de texto extraíble]`
    }

    return {
      ok: true,
      markdown,
      images,
      format: detectedFormat,
    }
  } catch (err: any) {
    const code = err?.code || err?.message || ''
    let friendlyError = `[Error al leer documento ${fileName}]`

    if (String(code).includes('encrypted') || String(err).includes('encrypted')) {
      friendlyError = `[Documento protegido con contraseña, no se pudo leer: ${fileName}]`
    } else if (String(code).includes('malformed') || String(err).includes('malformed')) {
      friendlyError = `[No se pudo leer el contenido, el archivo parece dañado: ${fileName}]`
    } else if (String(code).includes('unsupported') || String(err).includes('unsupported')) {
      friendlyError = `[Formato de documento no soportado para lectura de contenido: ${fileName}]`
    } else if (String(code).includes('resourceLimit') || String(err).includes('resourceLimit')) {
      friendlyError = `[Documento demasiado complejo o grande para procesar: ${fileName}]`
    }

    return {
      ok: false,
      markdown: friendlyError,
      images: [],
      error: String(err),
    }
  }
}
