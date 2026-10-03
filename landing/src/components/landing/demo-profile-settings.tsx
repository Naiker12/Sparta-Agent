import { useRef, useState } from 'react';
import { GeneratedAvatar } from '../../../../desktop/frontend-spartan/src/components/ui/blobatar-avatar';
import { BLOBATAR_AVATARS } from '../../../../desktop/frontend-spartan/src/features/profile/blobatar-avatars';
import { resizeImageFileToDataUrl } from '../../../../desktop/frontend-spartan/src/features/profile/utils/resize-image-file';
import { SettingsSection } from '../../../../desktop/frontend-spartan/src/features/settings/components/settings-section';
import { Button } from './desktop-demo-button';
import { DemoSettingRow, DemoSettingToggle } from './demo-setting-row';
import { DemoProfileAvatar } from './demo-profile-avatar';
import { useDemoPreferences } from './demo-preferences';

export function DemoProfileSettings({ name, onName, avatar, onAvatar, showAvatar, onShowAvatar, chats, responses }: { name: string; onName: (value: string) => void; avatar: string; onAvatar: (value: string) => void; showAvatar: boolean; onShowAvatar: (value: boolean) => void; chats: number; responses: number }) {
  const { prefs, update } = useDemoPreferences();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { setError('Elige una imagen PNG, JPEG, WebP o GIF.'); return; }
    setUploading(true);
    try { update({ avatarImage: await resizeImageFileToDataUrl(file) }); }
    catch { setError('No se pudo abrir esta imagen. Prueba con otra imagen.'); }
    finally { setUploading(false); }
  };
  return <>
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Seleccionar foto de perfil" className="sr-only" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
    <div className="demo-profile-photo-row"><button type="button" aria-label="Cambiar foto de perfil" disabled={uploading} onClick={() => fileRef.current?.click()}><DemoProfileAvatar seed={avatar} image={prefs.avatarImage} shape={prefs.avatarShape} size={106} /></button><div><Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? 'Procesando imagen…' : 'Subir imagen'}</Button>{prefs.avatarImage && <Button variant="ghost" onClick={() => update({ avatarImage: null })}>Quitar imagen</Button>}<p>La imagen permanece en esta demo durante la sesión.</p></div></div>
    {error && <p role="alert">{error}</p>}
    <SettingsSection title="Personalización">
      <DemoSettingRow label="Nombre visible"><input aria-label="Nombre visible" value={name} maxLength={200} onChange={event => onName(event.target.value)} onBlur={() => onName(name.trim())} /></DemoSettingRow>
      <DemoSettingRow label="Apodo" description="El nombre que aparece en tu saludo."><input aria-label="Apodo" value={prefs.nickname} maxLength={200} onChange={event => update({ nickname: event.target.value })} onBlur={() => update({ nickname: prefs.nickname.trim() })} /></DemoSettingRow>
      <DemoSettingRow label="Forma del avatar"><select aria-label="Forma del avatar" value={prefs.avatarShape} onChange={event => update({ avatarShape: event.target.value as 'circle' | 'rounded' })}><option value="circle">Círculo</option><option value="rounded">Redondeado</option></select></DemoSettingRow>
      <DemoSettingToggle label="Mostrar avatar de bienvenida" checked={showAvatar} onChange={onShowAvatar} />
    </SettingsSection>
    <SettingsSection title="Avatar" description="Los 28 avatares originales del escritorio."><div className="demo-settings-avatars">{BLOBATAR_AVATARS.map((seed, index) => <button type="button" key={seed} disabled={uploading} aria-label={`Elegir avatar ${index + 1}`} aria-pressed={!prefs.avatarImage && avatar === seed} onClick={() => { update({ avatarImage: null }); onAvatar(seed); }}><GeneratedAvatar name={seed} size={44} /></button>)}</div></SettingsSection>
    <SettingsSection title="Actividad de esta demo"><dl><dt>Conversaciones de ejemplo</dt><dd>{chats}</dd><dt>Respuestas en el historial local</dt><dd>{responses}</dd></dl><p>Las estadísticas de tokens y modelos reales se consultan en la aplicación instalada.</p></SettingsSection>
  </>;
}
