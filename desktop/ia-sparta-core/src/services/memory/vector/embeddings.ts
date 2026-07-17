const _sidecarBaseUrl = (() => {
  const fromEnv = import.meta.env.VITE_SIDECAR_HTTP_URL as string | undefined
  if (fromEnv) return fromEnv
  const host = (import.meta.env.VITE_SIDECAR_HOST as string) || 'localhost'
  const port = (import.meta.env.VITE_SIDECAR_HTTP_PORT as string) || '8765'
  return `http://${host}:${port}`
})()

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.sparta?.memoryEmbed
}

async function sidecarEmbed(texts: string[]): Promise<number[][] | null> {
  if (isElectron()) {
    const result = await window.sparta?.memoryEmbed(texts)
    if (!result?.ok || !Array.isArray(result.embeddings)) return null
    return result.embeddings
  }
  try {
    const res = await fetch(`${_sidecarBaseUrl}/api/memory/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texts }),
    })
    if (!res.ok) return null
    const data = await res.json() as { ok: boolean; embeddings?: number[][]; error?: string }
    if (!data.ok || !Array.isArray(data.embeddings)) return null
    return data.embeddings
  } catch {
    return null
  }
}

export async function embed(text: string): Promise<number[] | null> {
  const result = await sidecarEmbed([text])
  return result?.[0] ?? null
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return []
  const result = await sidecarEmbed(texts)
  if (!result) return texts.map(() => null)
  return result
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setActiveProvider(_provider: unknown): void {
  // Deprecated: embeddings are now computed exclusively by the Python sidecar
  // using a single model (all-MiniLM-L6-v2). This function is kept for API
  // compatibility but does nothing.
}

export function getActiveProvider(): null {
  return null
}

export function getEmbeddingModelLabel(): string {
  return 'Sidecar all-MiniLM-L6-v2'
}
