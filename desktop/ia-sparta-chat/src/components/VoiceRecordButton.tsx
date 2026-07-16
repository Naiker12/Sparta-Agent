import { useCallback, useEffect } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAudioRecorder } from 'ia-sparta-core'
import { useAudioTranscription } from 'ia-sparta-core'
import { AudioWaveform } from './AudioWaveform'

interface VoiceRecordButtonProps {
  onTranscript: (text: string) => void
}

export function VoiceRecordButton({ onTranscript }: VoiceRecordButtonProps) {
  const { isRecording, levels, start, stop, error: recorderError } = useAudioRecorder()
  const { transcribe, isTranscribing, error: transcriptionError } = useAudioTranscription()

  useEffect(() => {
    if (recorderError) toast.error(recorderError, { duration: 4000 })
  }, [recorderError])

  useEffect(() => {
    if (transcriptionError) toast.error(transcriptionError, { duration: 4000 })
  }, [transcriptionError])

  const handleClick = useCallback(async () => {
    if (isTranscribing) return

    if (isRecording) {
      const blob = await stop()
      if (!blob) return // too short or empty
      const text = await transcribe(blob)
      if (text) onTranscript(text)
      return
    }

    await start()
  }, [isRecording, isTranscribing, start, stop, transcribe, onTranscript])

  if (isRecording) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <AudioWaveform levels={levels} active />
        <button
          onClick={handleClick}
          title="Detener grabación"
          style={{
            width: 28,
            height: 28,
            background: 'var(--status-err)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          <Square size={10} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  if (isTranscribing) {
    return (
      <button
        disabled
        title="Transcribiendo..."
        style={{
          width: 28,
          height: 28,
          background: 'none',
          border: '1px solid var(--border-normal)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--accent)',
          cursor: 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      title="Grabar audio"
      style={{
        width: 28,
        height: 28,
        background: 'none',
        border: '1px solid var(--border-normal)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      <Mic size={13} strokeWidth={1.5} />
    </button>
  )
}
