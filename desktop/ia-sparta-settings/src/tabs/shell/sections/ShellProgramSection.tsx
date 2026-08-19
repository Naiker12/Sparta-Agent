import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { useSettingsStore } from 'ia-sparta-core'

const PRESET_SHELLS = [
  { label: 'PowerShell Windows', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' },
  { label: 'PowerShell Core (pwsh)', path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' },
  { label: 'System default (cmd.exe)', path: 'C:\\WINDOWS\\system32\\cmd.exe' },
  { label: 'Git Bash', path: 'C:\\Program Files\\Git\\bin\\bash.exe' },
  { label: 'WSL Bash (Linux)', path: 'C:\\Windows\\System32\\wsl.exe' },
]

export function ShellProgramSection() {
  const { shellProgram, setShellProgram } = useSettingsStore()
  const [selectedPreset, setSelectedPreset] = useState(
    PRESET_SHELLS.find((p) => p.path.toLowerCase() === (shellProgram || '').toLowerCase())?.path || 'custom'
  )
  const [customPath, setCustomPath] = useState(shellProgram || '')

  function handleSelectPreset(value: string) {
    setSelectedPreset(value)
    if (value !== 'custom') {
      setShellProgram(value)
    }
  }

  function handleCustomBlur() {
    if (customPath.trim()) {
      setShellProgram(customPath.trim())
    }
  }

  return (
    <SettingGroup
      title="Intérprete de Comandos & Shell"
      description="Selecciona la terminal que ejecutará las tareas de compilación, scripts y herramientas del agente."
    >
      <SettingRow
        label="Shell Predeterminado"
        description="Selecciona una de las terminales detectadas en tu sistema Windows."
      >
        <select
          value={selectedPreset}
          onChange={(e) => handleSelectPreset(e.target.value)}
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
          {PRESET_SHELLS.map((s) => (
            <option key={s.path} value={s.path}>
              {s.label}
            </option>
          ))}
          <option value="custom">Ruta personalizada...</option>
        </select>
      </SettingRow>

      {selectedPreset === 'custom' && (
        <SettingRow
          label="Ruta del Ejecutable"
          description="Ruta absoluta al binario o ejecutable (.exe) de tu shell."
        >
          <input
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            onBlur={handleCustomBlur}
            placeholder="C:\ruta\a\tu\shell.exe"
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '6px 12px',
              fontSize: 12,
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              outline: 'none',
              width: 260,
            }}
          />
        </SettingRow>
      )}
    </SettingGroup>
  )
}
