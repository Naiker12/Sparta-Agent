import { Switch } from '../../../../desktop/frontend-spartan/src/components/ui/switch';
import type { ReactNode } from 'react';

// Mirrors SettingsRow's wrapping label/control layout without its desktop tooltip services.
export function DemoSettingRow({ label, description, icon, children }: { label: string; description?: string; icon?: ReactNode; children: ReactNode }) {
  return <div className="demo-setting-row" data-settings-label={label}><div className="demo-setting-label">{icon}<div><span>{label}</span>{description && <p>{description}</p>}</div></div><div className="demo-setting-control">{children}</div></div>;
}
export function DemoSettingToggle({ label, description, icon, checked, onChange, disabled }: { label: string; description?: string; icon?: ReactNode; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <DemoSettingRow label={label} description={description} icon={icon}><Switch aria-label={label} checked={checked} onCheckedChange={onChange} disabled={disabled} /></DemoSettingRow>;
}
