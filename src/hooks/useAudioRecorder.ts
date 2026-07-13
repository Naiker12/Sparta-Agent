import { useCallback, useRef, useState } from 'react'

const BAR_COUNT = 24
const MIN_RECORDING_MS = 300

export interface UseAudioRecorderReturn {
  isRecording: boolean
  levels: number[]
  start: () => Promise<void>
  stop: () => Promise<Blob | null>
  error: string | null
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0))
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef(0)

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (analyserRef.current) {
      analyserRef.current.disconnect()
      analyserRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    setLevels(Array(BAR_COUNT).fill(0))
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Web Audio API for real-time volume
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)

      // MediaRecorder for capturing the blob
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      startTimeRef.current = Date.now()

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start(100) // collect in 100ms chunks
      setIsRecording(true)

      // Volume loop
      const loop = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
        setLevels((prev) => [...prev.slice(1), avg])
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Permiso de micrófono denegado. Habilitalo en la configuración del navegador.'
        : `Error al acceder al micrófono: ${err instanceof Error ? err.message : err}`
      setError(msg)
      cleanup()
    }
  }, [cleanup])

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      cleanup()
      return null
    }

    return new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const elapsed = Date.now() - startTimeRef.current
        cleanup()
        if (elapsed < MIN_RECORDING_MS) {
          resolve(null) // click accidental, discard
          return
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        resolve(blob.size > 0 ? blob : null)
      }
      recorder.stop()
      setIsRecording(false)
    })
  }, [cleanup])

  return { isRecording, levels, start, stop, error }
}
