import { useCallback, useRef, useState } from 'react'

function getSidecarBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_SIDECAR_HTTP_URL as string | undefined
  if (fromEnv) return fromEnv
  const host = (import.meta.env.VITE_SIDECAR_HOST as string) || 'localhost'
  const port = (import.meta.env.VITE_SIDECAR_HTTP_PORT as string) || '8765'
  return `http://${host}:${port}`
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.sparta?.transcribeAudio === 'function'
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // strip "data:...;base64," prefix
      resolve(result.split(',')[1] || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export interface UseAudioTranscriptionReturn {
  transcribe: (blob: Blob) => Promise<string | null>
  isTranscribing: boolean
  error: string | null
}

export function useAudioTranscription(): UseAudioTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const transcribe = useCallback(async (blob: Blob): Promise<string | null> => {
    setError(null)
    setIsTranscribing(true)
    abortRef.current = new AbortController()

    try {
      const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('ogg') ? 'ogg' : 'webm'

      // Electron mode: use IPC via the sidecar's stdin/stdout
      if (isElectron()) {
        const audio = await blobToBase64(blob)
        const result = await window.sparta!.transcribeAudio({
          audio,
          filename: `recording.${ext}`,
          language: 'es',
        })
        if (result.error) {
          setError(result.error)
          return null
        }
        return result.text?.trim() || null
      }

      // Web mode: use HTTP endpoint on the FastAPI sidecar
      const file = new File([blob], `recording.${ext}`, { type: blob.type })
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${getSidecarBaseUrl()}/api/audio/transcribe`, {
        method: 'POST',
        body: formData,
        signal: abortRef.current.signal,
      })

      if (res.status === 503) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Transcripción no disponible')
        return null
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Error del servidor: ${res.status}`)
        return null
      }

      const data = await res.json() as { text?: string }
      return data.text?.trim() || null
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null
      setError(`Error de conexión con el sidecar: ${err instanceof Error ? err.message : err}`)
      return null
    } finally {
      setIsTranscribing(false)
      abortRef.current = null
    }
  }, [])

  return { transcribe, isTranscribing, error }
}
