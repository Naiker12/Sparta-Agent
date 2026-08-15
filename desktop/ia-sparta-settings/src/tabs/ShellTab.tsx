import { useState } from 'react'
import { Check, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { useSettingsStore } from 'ia-sparta-core'

const PRESET_SHELLS = [
  { label: 'System default (cmd.exe)', path: 'C:\\WINDOWS\\system32\\cmd.exe' },
  { label: 'PowerShell Windows', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' },
  { label: 'PowerShell Core (pwsh)', path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' },
  { label: 'Git Bash', path: 'C:\\Program Files\\Git\\bin\\bash.exe' },
  { label: 'WSL Bash (Linux)', path: 'C:\\Windows\\System32\\wsl.exe' },
]

export function ShellTab() {
  const {
    shellProgram,
    shellFlags,
    envOverrides,
    setShellProgram,
    setShellFlags,
    setEnvOverrides,
  } = useSettingsStore()

  const [selectedPreset, setSelectedPreset] = useState(
    PRESET_SHELLS.find((p) => p.path.toLowerCase() === (shellProgram || '').toLowerCase())?.path || 'custom'
  )
  const [customPath, setCustomPath] = useState(shellProgram || '')
  const [newFlagInput, setNewFlagInput] = useState('')
  const [showAddFlag, setShowAddFlag] = useState(false)

  // Env variable form state
  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvValue, setNewEnvValue] = useState('')
  const [showAddEnv, setShowAddEnv] = useState(false)

  const effectiveCommand = `${shellProgram || 'cmd.exe'} ${shellFlags.join(' ')}`.trim()

  function handleSelectPreset(value: string) {
    setSelectedPreset(value)
    if (value !== 'custom') {
      setShellProgram(value)
    }
  }

  function handleAddFlag() {
    const trimmed = newFlagInput.trim()
    if (!trimmed) return
    setShellFlags([...shellFlags, trimmed])
    setNewFlagInput('')
    setShowAddFlag(false)
  }

  function handleRemoveFlag(index: number) {
    setShellFlags(shellFlags.filter((_, i) => i !== index))
  }

  function handleRestoreDefaultFlags() {
    setShellFlags([])
  }

  function handleAddEnvVar() {
    const key = newEnvKey.trim().toUpperCase()
    const val = newEnvValue.trim()
    if (!key) return

    setEnvOverrides({ ...envOverrides, [key]: val })
    setNewEnvKey('')
    setNewEnvValue('')
    setShowAddEnv(false)
  }

  function handleRemoveEnvVar(key: string) {
    const updated = { ...envOverrides }
    delete updated[key]
    setEnvOverrides(updated)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
      {/* Header section */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-ui)' }}>
          Shell
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45, fontFamily: 'var(--font-ui)' }}>
          How Sparta launches terminals, the host, and provider harnesses. New terminals pick up shell changes immediately; host env changes apply on restart.
        </p>
      </div>

      {/* CARD 1: Shell Executable & Flags */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-ui)' }}>
            Shell
          </h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            The program and flags every terminal tab starts with.
          </span>
        </div>

        {/* Effective Command Preview (Traycer Terminal Window Card) */}
        <div
          style={{
            background: 'var(--bg-modal)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              background: 'var(--bg-input)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
            </div>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'lowercase' }}>
              effective command
            </span>
          </div>
          <div style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>
            &gt; {effectiveCommand}
          </div>
        </div>

        {/* Shell Program Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', display: 'block' }}>
              Shell program
            </label>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
              Pick a shell, or add any program on this machine.
            </span>
          </div>

          <select
            value={selectedPreset}
            onChange={(e) => handleSelectPreset(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: 11.5,
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer',
              minWidth: 260,
            }}
          >
            {PRESET_SHELLS.map((p) => (
              <option key={p.path} value={p.path}>
                {p.label}
              </option>
            ))}
            <option value="custom">Personalizado...</option>
          </select>
        </div>

        {selectedPreset === 'custom' && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Ruta del Ejecutable Personalizado
            </label>
            <input
              value={customPath}
              onChange={(e) => {
                setCustomPath(e.target.value)
                setShellProgram(e.target.value)
              }}
              placeholder="Ej: C:\Program Files\PowerShell\7\pwsh.exe"
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 11.5,
                fontFamily: 'var(--font-mono)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Startup Flags Section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', display: 'block' }}>
              Startup flags for shell
            </label>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
              Passed to shell each time a terminal opens.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {shellFlags.length === 0 ? (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No flags</span>
            ) : (
              shellFlags.map((flag, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {flag}
                  <button
                    onClick={() => handleRemoveFlag(idx)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))
            )}

            {showAddFlag ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  value={newFlagInput}
                  onChange={(e) => setNewFlagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddFlag() }}
                  placeholder="-NoLogo"
                  autoFocus
                  style={{
                    padding: '2px 6px',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    width: 90,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleAddFlag}
                  style={{ padding: '2px 6px', fontSize: 10, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                >
                  Ok
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddFlag(true)}
                style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  background: 'none',
                  border: '1px dashed var(--border-normal)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                + flag
              </button>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={handleRestoreDefaultFlags}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RefreshCw size={12} /> Restore default flags
          </button>

          <span style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
            <Check size={12} /> Saved
          </span>
        </div>
      </div>

      {/* CARD 2: Environment Variables Editor */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-ui)' }}>
              Environment variables
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Set or unset variables for the host process; applied on its next restart. Per-harness variables live in Settings → Providers.
            </span>
          </div>

          <span style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
            <Check size={12} /> Saved
          </span>
        </div>

        {/* Table of Environment Variables */}
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.5fr 40px',
              padding: '6px 12px',
              background: 'var(--bg-input)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span>Name</span>
            <span>Value</span>
            <span style={{ textAlign: 'right' }}>Action</span>
          </div>

          {Object.keys(envOverrides).length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11.5, lineHeight: 1.5 }}>
              No host environment variables. The host starts with the environment your shell produces.
            </div>
          ) : (
            Object.entries(envOverrides).map(([key, val]) => (
              <div
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.5fr 40px',
                  padding: '8px 12px',
                  fontSize: 11.5,
                  fontFamily: 'var(--font-mono)',
                  borderBottom: '1px solid var(--border-subtle)',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{key}</span>
                <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
                <button
                  onClick={() => handleRemoveEnvVar(key)}
                  style={{ background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer', justifySelf: 'end' }}
                  title="Eliminar variable"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Env Variable Inline Form */}
        {showAddEnv ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-input)', padding: 8, borderRadius: 'var(--radius-md)' }}>
            <input
              value={newEnvKey}
              onChange={(e) => setNewEnvKey(e.target.value)}
              placeholder="NOMBRE_VARIABLE"
              style={{
                flex: 1, padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
                background: 'var(--bg-surface)', border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <input
              value={newEnvValue}
              onChange={(e) => setNewEnvValue(e.target.value)}
              placeholder="valor"
              style={{
                flex: 1.5, padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
                background: 'var(--bg-surface)', border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <button
              onClick={handleAddEnvVar}
              style={{ padding: '5px 12px', fontSize: 11, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            >
              Guardar
            </button>
            <button
              onClick={() => setShowAddEnv(false)}
              style={{ padding: '5px 8px', fontSize: 11, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddEnv(true)}
            style={{
              alignSelf: 'flex-start',
              padding: '6px 12px',
              fontSize: 11.5,
              background: 'none',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 500,
              fontFamily: 'var(--font-ui)',
            }}
          >
            <Plus size={13} style={{ color: 'var(--accent)' }} /> Add environment variable
          </button>
        )}
      </div>
    </div>
  )
}
