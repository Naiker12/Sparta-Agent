import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { Check } from 'lucide-react'

export function InferenceBackendSection() {
  const [backend, setBackend] = useState('auto')
  const [appliedBackend, setAppliedBackend] = useState('auto')
  const [isApplying, setIsApplying] = useState(false)

  const isDirty = backend !== appliedBackend

  function handleApply() {
    setIsApplying(true)
    setTimeout(() => {
      setIsApplying(false)
      setAppliedBackend(backend)
    }, 600)
  }

  return (
    <SettingGroup
      title="Motor de Cómputo e Inferencia"
      description="Selecciona la aceleración por hardware para modelos locales (GGUF, Safetensors, vLLM)."
    >
      <SettingRow
        label="Backend de Aceleración"
        description="Selecciona CUDA para GPUs NVIDIA, Vulkan para multi-plataforma o CPU estándar."
        action={
          <button
            type="button"
            onClick={handleApply}
            disabled={!isDirty || isApplying}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 6px)',
              backgroundColor: isDirty ? 'var(--accent)' : 'var(--bg-elevated)',
              border: 'none',
              color: isDirty ? '#FFFFFF' : 'var(--text-muted)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: isDirty ? 'pointer' : 'default',
            }}
          >
            {isApplying ? (
              <span>Aplicando...</span>
            ) : !isDirty ? (
              <>
                <Check size={12} strokeWidth={3} />
                <span>Aplicado</span>
              </>
            ) : (
              <span>Aplicar</span>
            )}
          </button>
        }
      >
        <select
          value={backend}
          onChange={(e) => setBackend(e.target.value)}
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
          <option value="auto">Automático (Recomendado)</option>
          <option value="cuda">NVIDIA CUDA (Tensor Cores)</option>
          <option value="vulkan">Vulkan (GPU Universal)</option>
          <option value="cpu">Solo CPU (AVX2 / OpenMP)</option>
        </select>
      </SettingRow>
    </SettingGroup>
  )
}
