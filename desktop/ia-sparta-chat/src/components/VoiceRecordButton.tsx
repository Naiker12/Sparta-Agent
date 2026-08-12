import { useCallback, useEffect, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { toastReplace, useAudioRecorder, useAudioTranscription } from 'ia-sparta-core'
import { AudioWaveform } from './AudioWaveform'
import { VoiceReactiveOrb } from './reasoning/VoiceReactiveOrb'

interface VoiceRecordButtonProps {
  onTranscript: (text: string) => void
}

export function VoiceRecordButton({ onTranscript }: VoiceRecordButtonProps) {
  const { isRecording, levels, start, stop, error: recorderError } = useAudioRecorder()
  const { transcribe, isTranscribing, error: transcriptionError } = useAudioTranscription()
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    if (!recorderError) return
    toastReplace('error', 'microphone', 'Micrófono no disponible', {
      description: recorderError,
      duration: 6500,
    })
  }, [recorderError])

  useEffect(() => {
    if (!transcriptionError) return
    toastReplace('error', 'transcription', 'No se pudo transcribir el audio', {
      description: transcriptionError,
      duration: 6500,
    })
  }, [transcriptionError])

  const handleClick = useCallback(async () => {
    if (isTranscribing || isStarting) return

    if (isRecording) {
      const blob = await stop()
      if (!blob) return // too short or empty
      const text = await transcribe(blob)
      if (text) onTranscript(text)
      return
    }

    setIsStarting(true)
    try {
      await start()
    } finally {
      setIsStarting(false)
    }
  }, [isRecording, isStarting, isTranscribing, start, stop, transcribe, onTranscript])

  if (isRecording) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <VoiceReactiveOrb active={isRecording} />
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
      disabled={isStarting}
      title={isStarting ? 'Iniciando micrófono...' : 'Grabar audio'}
      style={{
        width: 28,
        height: 28,
        background: 'none',
        border: '1px solid var(--border-normal)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-muted)',
        cursor: isStarting ? 'wait' : 'pointer',
        opacity: isStarting ? 0.65 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {isStarting ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> : <Mic size={13} strokeWidth={1.5} />}
    </button>
  )
}
