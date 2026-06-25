import { useSettingsStore } from '@/stores/settings.store'
import { useTranslation } from '@/i18n'
import { SettingRow, SettingGroup } from './primitives'

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

export function GeneralTab() {
  const { defaultModel, setDefaultModel, memoryEnabled, toggleMemory, language, setLanguage } = useSettingsStore()
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
    </div>
  )
}
