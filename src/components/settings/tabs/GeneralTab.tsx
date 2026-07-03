import { useSettingsStore } from '@/stores/settings.store'
import { useTranslation } from '@/i18n'
import { SettingRow, SettingGroup } from './primitives'
import type { ReasoningEffort } from '@/types'

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 32,
        height: 16,
        borderRadius: 8,
        background: value ? 'var(--accent)' : 'var(--border-normal)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.15s',
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: 2,
          left: value ? 18 : 2,
          transition: 'left 0.15s',
        }}
      />
    </button>
  )
}

const EFFORT_LEVELS: { value: ReasoningEffort; label: string; desc: string }[] = [
  { value: 'none', label: 'None', desc: 'Sin razonamiento' },
  { value: 'minimal', label: 'Minimal', desc: 'Mínimo esfuerzo' },
  { value: 'low', label: 'Low', desc: 'Bajo' },
  { value: 'medium', label: 'Medium', desc: 'Medio (default)' },
  { value: 'high', label: 'High', desc: 'Alto' },
  { value: 'xhigh', label: 'X-High', desc: 'Máximo esfuerzo' },
]

const EFFORT_STEPS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const

export function GeneralTab() {
  const { defaultModel, setDefaultModel, memoryEnabled, toggleMemory, language, setLanguage, reasoningEnabled, toggleReasoning, reasoningEffort, setReasoningEffort, reasoningBudget, setReasoningBudget } = useSettingsStore()
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup title={t('general.defaults')} description={t('general.defaultsDesc')}>
        <div style={{ paddingTop: 4 }}>
          <label
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              display: 'block',
              marginBottom: 6,
            }}
          >
            {t('general.defaultModel')}
          </label>
          <input
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
        </div>
      </SettingGroup>

      <SettingGroup title={t('general.memory')} description={t('general.memoryDesc')}>
        <SettingRow
          title={t('general.persistentMemory')}
          description={t('general.persistentMemoryDesc')}
          control={<Toggle value={memoryEnabled} onChange={toggleMemory} />}
        />
      </SettingGroup>

      <SettingGroup title={t('general.language')} description={t('general.languageDesc')}>
        <SettingRow
          title={t('general.language')}
          description=""
          control={
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'es' | 'en')}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)',
                padding: '5px 8px',
                fontSize: 12,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="es">{t('general.spanish')}</option>
              <option value="en">{t('general.english')}</option>
            </select>
          }
        />
      </SettingGroup>

      <SettingGroup title="Razonamiento" description="Control de razonamiento visible del modelo">
        <SettingRow
          title="Razonamiento visible"
          description="Mostrar el proceso de razonamiento del modelo"
          control={<Toggle value={reasoningEnabled} onChange={toggleReasoning} />}
        />
        {reasoningEnabled && (
          <>
            <div style={{ paddingTop: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 4 }}>
                Esfuerzo de razonamiento: {reasoningEffort}
              </label>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={EFFORT_STEPS.indexOf(reasoningEffort)}
                onChange={(e) => {
                  const idx = parseInt(e.target.value)
                  setReasoningEffort(EFFORT_STEPS[idx])
                }}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {EFFORT_LEVELS.map((lvl) => (
                  <span key={lvl.value} style={{ opacity: reasoningEffort === lvl.value ? 1 : 0.4 }}>{lvl.label}</span>
                ))}
              </div>
            </div>
            <div style={{ paddingTop: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 4 }}>
                Budget de tokens: {reasoningBudget}
              </label>
              <input
                type="range"
                min={0}
                max={32000}
                step={1024}
                value={reasoningBudget}
                onChange={(e) => setReasoningBudget(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
          </>
        )}
      </SettingGroup>
    </div>
  )
}
