import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { Switch } from 'ia-sparta-design-system'

export function TextToSpeechSection() {
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [ttsEngine, setTtsEngine] = useState('browser-native')
  const [voice, setVoice] = useState('es-sparta-neural')
  const [speed, setSpeed] = useState(1.0)

  return (
    <SettingGroup
      title="Lectura en Voz Alta (Text-to-Speech / TTS)"
      description="Escucha las respuestas del asistente con voces sintetizadas de alta fidelidad."
    >
      <SettingRow
        label="Botón de Lectura en Voz Alta"
        description="Muestra el icono de altavoz debajo de cada respuesta para reproducirla."
      >
        <Switch
          checked={ttsEnabled}
          onCheckedChange={setTtsEnabled}
        />
      </SettingRow>

      <SettingRow
        label="Motor TTS"
        description="Motor de síntesis vocal."
      >
        <select
          value={ttsEngine}
          onChange={(e) => setTtsEngine(e.target.value)}
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
          <option value="browser-native">Síntesis Vocal Nativa</option>
          <option value="kokoro-onnx">Kokoro TTS 82M (Local ONNX)</option>
          <option value="elevenlabs">ElevenLabs API (Cloud)</option>
        </select>
      </SettingRow>

      <SettingRow
        label="Voz del Asistente"
        description="Voz y tono para lectura."
      >
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
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
          <option value="es-sparta-neural">Español — Sparta Neural (Natural)</option>
          <option value="es-alvaro">Español — Álvaro (Cálida)</option>
          <option value="es-elena">Español — Elena (Profesional)</option>
          <option value="en-alloy">English — Alloy</option>
        </select>
      </SettingRow>

      <SettingRow
        label="Velocidad de Reproducción"
        description={`${speed.toFixed(1)}x velocidad`}
      >
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          style={{
            width: 140,
            accentColor: 'var(--accent)',
            cursor: 'pointer',
          }}
        />
      </SettingRow>
    </SettingGroup>
  )
}
