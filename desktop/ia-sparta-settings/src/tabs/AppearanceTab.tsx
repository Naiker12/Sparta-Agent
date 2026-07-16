import { ThemePicker } from '../ThemePicker'
import { SettingGroup } from './primitives'
import { useTranslation } from 'ia-sparta-i18n'

function SettingRowStatic({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '10px 0',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 500,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {value}
      </div>
    </div>
  )
}

export function AppearanceTab() {
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup title={t('appearance.theme')} description={t('appearance.themeDesc')}>
        <div style={{ paddingTop: 4 }}>
          <ThemePicker />
        </div>
      </SettingGroup>

      <SettingGroup title={t('appearance.typography')} description={t('appearance.typographyDesc')}>
        <SettingRowStatic title={t('appearance.fontUI')} value="Geist / Inter" />
        <SettingRowStatic title={t('appearance.fontMono')} value="Geist Mono" />
        <SettingRowStatic title={t('appearance.baseSize')} value="13px" />
      </SettingGroup>

      <SettingGroup title={t('appearance.window')} description={t('appearance.windowDesc')}>
        <SettingRowStatic title={t('appearance.transparency')} value={t('appearance.disabled')} />
        <SettingRowStatic title={t('appearance.roundedBorders')} value={t('appearance.enabled')} />
      </SettingGroup>
    </div>
  )
}
