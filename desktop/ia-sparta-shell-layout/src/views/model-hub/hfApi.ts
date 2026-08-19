import type { ModelQuantOption } from './types'

export interface HfModelApiData {
  id: string
  modelId: string
  author?: string
  downloads?: number
  likes?: number
  lastModified?: string
  tags?: string[]
  pipeline_tag?: string
  siblings?: Array<{ rfilename: string }>
  quants?: ModelQuantOption[]
  readme?: string
}

const memoryCache = new Map<string, HfModelApiData>()

/**
 * Consulta la API pública de Hugging Face para obtener metadatos y archivos .gguf en vivo
 */
export async function fetchHfModelInfo(modelName: string): Promise<HfModelApiData | null> {
  const cleanId = modelName.trim()
  if (!cleanId) return null

  if (memoryCache.has(cleanId)) {
    return memoryCache.get(cleanId)!
  }

  try {
    const res = await fetch(`https://huggingface.co/api/models/${cleanId}`, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!res.ok) return null

    const data = await res.json()

    // Detectar archivos de cuantizaciones (.gguf) en el repositorio
    const quants: ModelQuantOption[] = []
    if (Array.isArray(data.siblings)) {
      data.siblings.forEach((f: { rfilename: string }) => {
        const fn = f.rfilename
        if (fn.toLowerCase().endsWith('.gguf')) {
          const upper = fn.toUpperCase()
          let quantLabel = fn.replace(/\.gguf$/i, '')
          if (upper.includes('UD-Q4_K_XL')) quantLabel = 'UD-Q4_K_XL • GGUF (Unsloth Dynamic)'
          else if (upper.includes('UD-Q8_0')) quantLabel = 'UD-Q8_0 • GGUF'
          else if (upper.includes('UD-Q5_K_M')) quantLabel = 'UD-Q5_K_M • GGUF'
          else if (upper.includes('UD-IQ4_XS')) quantLabel = 'UD-IQ4_XS • GGUF'
          else if (upper.includes('Q4_K_M')) quantLabel = 'Q4_K_M • GGUF'
          else if (upper.includes('Q8_0')) quantLabel = 'Q8_0 • GGUF'
          else if (upper.includes('Q5_K_M')) quantLabel = 'Q5_K_M • GGUF'

          quants.push({
            name: quantLabel,
            format: 'GGUF',
            size: 'En línea',
            recommended: upper.includes('Q4') || upper.includes('UD-Q4'),
          })
        }
      })
    }

    const result: HfModelApiData = {
      id: data.id || cleanId,
      modelId: data.modelId || cleanId,
      author: data.author || cleanId.split('/')[0] || 'unsloth',
      downloads: data.downloads,
      likes: data.likes,
      lastModified: data.lastModified,
      tags: data.tags,
      pipeline_tag: data.pipeline_tag,
      siblings: data.siblings,
      quants: quants.length > 0 ? quants : undefined,
    }

    memoryCache.set(cleanId, result)
    return result
  } catch (err) {
    console.warn(`[HfApi] No se pudieron obtener datos remotos para ${cleanId}:`, err)
    return null
  }
}
