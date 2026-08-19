import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { Switch } from 'ia-sparta-design-system'
import { Download, Check } from 'lucide-react'

export function DictationSection() {
  const [dictationEnabled, setDictationEnabled] = useState(false)
  const [engine, setEngine] = useState('whisper-local')
  const [model, setModel] = useState('qwen3-asr-0.6b')
  const [micDevice, setMicDevice] = useState('default')
  const [language, setLanguage] = useState('auto')
  const [downloaded, setDownloaded] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  function handleDownload() {
    setIsDownloading(true)
    setTimeout(() => {
      setIsDownloading(false)
      setDownloaded(true)
    }, 1500)
  }

  return (
    <SettingGroup
      title="Dictado & Reconocimiento de Voz (STT)"
      description="Transcribe voz a texto en tiempo real usando modelos de inferencia local sin enviar audio a la nube."
    >
      <SettingRow
        label="Habilitar Dictado por Voz"
        description="Activa el botón de micrófono en la barra de chat para dictar prompts directamente."
      >
        <Switch
          checked={dictationEnabled}
          onCheckedChange={setDictationEnabled}
        />
      </SettingRow>

      <SettingRow
        label="Motor STT"
        description="Motor de procesamiento de audio en tu dispositivo."
      >
        <select
          value={engine}
          onChange={(e) => setEngine(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '6px 12px',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            outline: 'none',
          }}
        >
          <option value="whisper-local">Whisper Local (vLLM / ONNX)</option>
          <option value="qwen-asr">Qwen3-ASR (Ultra Ligero)</option>
          <option value="browser-native">API Nativa del Sistema</option>
        </select>
      </SettingRow>

      <SettingRow
        label="Modelo de Transcripción"
        description="Modelo de pesos para inferencia en CPU/GPU."
        action={
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloaded || isDownloading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 'var(--radius-md, 6px)',
              backgroundColor: downloaded ? 'var(--bg-elevated)' : 'var(--accent)',
              border: 'none',
              color: downloaded ? 'var(--status-ok, #10B981)' : '#FFFFFF',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: downloaded ? 'default' : 'pointer',
            }}
          >
            {downloaded ? (
              <>
                <Check size={12} strokeWidth={3} />
                <span>Descargado</span>
              </>
            ) : isDownloading ? (
              <span>Descargando...</span>
            ) : (
              <>
                <Download size={12} />
                <span>Descargar</span>
              </>
            )}
          </button>
        }
      >
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '6px 12px',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            outline: 'none',
          }}
        >
          <option value="qwen3-asr-0.6b">Qwen3-ASR 0.6B (GGUF 420 MB)</option>
          <option value="whisper-small">Whisper Small v3 (GGUF 480 MB)</option>
          <option value="whisper-large">Whisper Large v3 Turbo (1.5 GB)</option>
        </select>
      </SettingRow>

      <SettingRow
        label="Dispositivo de Micrófono"
        description="Micrófono de captura predeterminado."
      >
        <select
          value={micDevice}
          onChange={(e) => setMicDevice(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '6px 12px',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            outline: 'none',
          }}
        >
          <option value="default">Micrófono por Defecto del Sistema</option>
          <option value="headset">Auriculares / Headset</option>
        </select>
      </SettingRow>

      <SettingRow
        label="Idioma Principal de Dictado"
        description="Idioma preferido para el reconocimiento automático."
      >
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '6px 12px',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            outline: 'none',
          }}
        >
          <option value="auto">Detección Automática</option>
          <option value="es">Español (ES/LATAM)</option>
          <option value="en">English (US/UK)</option>
        </select>
      </SettingRow>
    </SettingGroup>
  )
}
