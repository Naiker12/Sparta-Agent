import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { Settings02Icon, UserIcon, PaintBrush02Icon, Message01Icon, Globe02Icon, CloudIcon, DatabaseSettingIcon, KeyboardIcon, ComputerTerminal01Icon, HelpCircleIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { X } from 'lucide-react';
import { DemoProfileSettings } from './demo-profile-settings';
import { Button } from './desktop-demo-button';
import { release, repository } from '@/lib/releases';

import { SettingsSection } from '../../../../desktop/frontend-spartan/src/features/settings/components/settings-section';
import { Switch } from '../../../../desktop/frontend-spartan/src/components/ui/switch';
import { DemoApiKeys, DemoConnections, DemoLogs, DemoShortcuts } from './demo-settings-panels';
import { DemoAppearanceSettings } from './demo-appearance-settings';
import { DemoChatSettings } from './demo-chat-settings';
import { DemoSettingRow } from './demo-setting-row';
import { DEFAULT_DEMO_PREFERENCES, useDemoPreferences } from './demo-preferences';

const tabs = [
  { id: 'general', label: 'General', icon: Settings02Icon }, { id: 'profile', label: 'Perfil', icon: UserIcon },
  { id: 'appearance', label: 'Apariencia', icon: PaintBrush02Icon }, { id: 'chat', label: 'Chat', icon: Message01Icon },
  { id: 'api', label: 'API', icon: Globe02Icon }, { id: 'connections', label: 'Conexiones', icon: CloudIcon },
  { id: 'data', label: 'Datos', icon: DatabaseSettingIcon }, { id: 'shortcuts', label: 'Atajos', icon: KeyboardIcon },
  { id: 'logs', label: 'Registros', icon: ComputerTerminal01Icon }, { id: 'about', label: 'Acerca de', icon: HelpCircleIcon },
] as const;
export type DemoSettingsTab = typeof tabs[number]['id'];

const keywords: Record<DemoSettingsTab, string> = { general: 'idioma versión inicio bandeja restablecer permisos', profile: 'nombre apodo avatar perfil estadísticas', appearance: 'tema claro oscuro sistema paleta clásica minimalista acento fondo primer plano color contraste barra lateral tamaño fuente tipografía movimiento suavizado puntero', chat: 'thinking enter razonamiento temperatura tokens instrucciones sistema top p menú mcp canvas avatar pegar proyectos aviso modelo respuesta recordar adjuntos compartir titular', api: 'clave token crear revocar acceso', connections: 'proveedor openai anthropic gemini openrouter conexión modelo url mcp', data: 'archivar restaurar conversación exportar importar datos', shortcuts: 'teclado atajos buscar ctrl', logs: 'diagnóstico registros copiar estado', about: 'versión licencia ayuda github' };

export function DemoSettingsDialog({ tab, onTab, onClose, theme, onTheme, profileName, onProfileName, avatar, onAvatar, collapseThinking, onCollapseThinking, enterSends, onEnterSends, mcp, onMcp, onReset, chats, archived, onArchive, onRestore, history, showAvatar, onShowAvatar, compact, onCompact, onReduceMotion, permission, onPermission, selectedModel }: {
  tab: DemoSettingsTab | null; onTab: (tab: DemoSettingsTab) => void; onClose: () => void;
  theme: 'light' | 'dark'; onTheme: (theme: 'light' | 'dark') => void; profileName: string; onProfileName: (name: string) => void;
  avatar: string; onAvatar: (seed: string) => void; collapseThinking: boolean; onCollapseThinking: (value: boolean) => void;
  enterSends: boolean; onEnterSends: (value: boolean) => void; mcp: boolean; onMcp: (value: boolean) => void; onReset: () => void;
  chats: string[]; archived: number[]; onArchive: (id: number) => void; onRestore: (id: number) => void;
  history: { prompt: string; reply: string }[]; selectedModel: string;
  showAvatar: boolean; onShowAvatar: (value: boolean) => void; compact: boolean; onCompact: (value: boolean) => void;
  onReduceMotion: (value: boolean) => void;
  permission: string; onPermission: (value: string) => void;
}) {
  const { style, prefs, update } = useDemoPreferences();
  const [search, setSearch] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [dataPage, setDataPage] = useState<'manage' | 'archived'>('manage');
  const [notice, setNotice] = useState('');
  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [tab]);
  const current = tabs.find(item => item.id === tab);
  const visibleTabs = tabs.filter(item => `${item.label} ${keywords[item.id]}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ source: 'sparta-landing-demo', chats: chats.map((name, id) => ({ name, archived: archived.includes(id) })), history }, (_key, value) => value instanceof File ? { name: value.name, size: value.size, type: value.type } : value, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'sparta-demo.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Exportación preparada; el navegador gestiona la descarga.');
  };
  return <Dialog.Root open={tab !== null} onOpenChange={open => { if (!open) { onClose(); setSearch(''); setNotice(''); } }}>
    <Dialog.Portal keepMounted><Dialog.Backdrop className="demo-settings-backdrop" /><Dialog.Popup className="sparta-preview demo-settings-dialog" data-demo-theme={theme} style={style}>
      <Dialog.Title className="sr-only">Configuración de la demo</Dialog.Title>
      <Dialog.Description className="sr-only">Configuración local de ejemplo con las secciones de la aplicación de escritorio.</Dialog.Description>
      <aside className="demo-settings-nav"><label className="demo-settings-search"><HugeiconsIcon icon={Search01Icon} /><input aria-label="Buscar en la configuración" placeholder="Buscar en la configuración" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <p>Configuración</p><nav aria-label="Secciones de configuración">{visibleTabs.map(item => <button type="button" key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => { onTab(item.id); setNotice(''); }}><HugeiconsIcon icon={item.icon} strokeWidth={1.75} />{item.label}</button>)}{visibleTabs.length === 0 && <p>No hay secciones que coincidan.</p>}</nav>
      </aside>
      <main ref={contentRef} className="demo-settings-content"><header><h2>{current?.label}</h2><Dialog.Close aria-label="Cerrar configuración"><X /></Dialog.Close></header>
        <p className="demo-settings-description">{({ general: 'Preferencias globales de Sparta.', profile: 'Cómo apareces en tu espacio de trabajo.', appearance: 'Cómo se ve Spartan en este dispositivo.', chat: 'Personaliza cómo funciona el chat en este dispositivo.', api: 'Administra el acceso a la API de Sparta.', connections: 'Configura tus proveedores y herramientas.', data: 'Administra las conversaciones de ejemplo.', shortcuts: 'Atajos del teclado de la aplicación.', logs: 'Inspecciona el estado de esta demostración.', about: 'Información de Sparta Agent.' } as const)[tab || 'general']}</p>
        {tab === 'general' && <>
          <SettingsSection title="Sparta Agent"><DemoSettingRow label="Versión de Spartan"><code>v{release.version}</code></DemoSettingRow><DemoSettingRow label="Versión del paquete"><code>{release.version}</code></DemoSettingRow></SettingsSection>
          <SettingsSection title="Idioma"><DemoSettingRow label="Idioma de la interfaz" description="La demo está disponible en español. El escritorio incluye selección de idioma."><select aria-label="Idioma de la demo" disabled value="es"><option value="es">Español</option></select></DemoSettingRow></SettingsSection>
          <SettingsSection title="Permisos"><DemoSettingRow label="Permisos de herramientas" description="Cómo aprueba Sparta las herramientas del chat. Esta selección modifica el composer de ejemplo."><select aria-label="Modo de aprobación predeterminado" value={permission} onChange={event => onPermission(event.target.value)}><option value="ask">Pedir aprobación</option><option value="auto">Aprobar por mí</option><option value="off">Ejecutar automáticamente</option><option value="full">Acceso completo</option></select></DemoSettingRow></SettingsSection>
          <SettingsSection title="Zona de peligro"><DemoSettingRow label="Restablecer preferencias locales" description="Restablece la configuración de esta demo. Conserva sus chats y sus nombres."><Button variant="outline" onClick={() => setConfirmReset(true)}>Restablecer preferencias</Button></DemoSettingRow>{confirmReset && <div role="group" aria-label="Confirmar restablecimiento"><p>¿Restablecer las preferencias de esta demostración?</p><Button onClick={() => { update({ ...DEFAULT_DEMO_PREFERENCES, nickname: prefs.nickname, avatarImage: prefs.avatarImage, avatarShape: prefs.avatarShape, resetEpoch: prefs.resetEpoch + 1 }); onTheme('light'); onCompact(false); onReduceMotion(matchMedia('(prefers-reduced-motion: reduce)').matches); onCollapseThinking(false); onEnterSends(true); onShowAvatar(true); onPermission('auto'); setConfirmReset(false); setNotice('Preferencias locales restablecidas.'); }}>Confirmar restablecimiento</Button><Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancelar</Button></div>}</SettingsSection>
        </>}
        {tab === 'profile' && <DemoProfileSettings name={profileName} onName={onProfileName} avatar={avatar} onAvatar={onAvatar} showAvatar={showAvatar} onShowAvatar={onShowAvatar} chats={chats.length} responses={history.length} />}
        {tab === 'appearance' && <DemoAppearanceSettings theme={theme} onTheme={onTheme} compact={compact} onCompact={onCompact} onReduceMotion={onReduceMotion} />}
        <div hidden={tab !== 'chat'}><DemoChatSettings selectedModel={selectedModel} collapseThinking={collapseThinking} onCollapseThinking={onCollapseThinking} enterSends={enterSends} onEnterSends={onEnterSends} showAvatar={showAvatar} onShowAvatar={onShowAvatar} /></div>
        <div hidden={tab !== 'api'}><DemoApiKeys /></div>
        <div hidden={tab !== 'connections'}><DemoConnections /><SettingsSection title="Herramientas MCP"><Toggle label="Activar MCP en el composer de ejemplo" checked={mcp} onChange={onMcp} /></SettingsSection></div>
        {tab === 'data' && <><SettingsSection title="Conversaciones de ejemplo"><div className="demo-settings-button-row"><Button variant={dataPage === 'manage' ? 'secondary' : 'ghost'} onClick={() => setDataPage('manage')}>Administrar</Button><Button variant={dataPage === 'archived' ? 'secondary' : 'ghost'} onClick={() => setDataPage('archived')}>Archivadas ({archived.length})</Button></div>{chats.map((name, id) => archived.includes(id) === (dataPage === 'archived') && <div className="demo-settings-provider" key={id}><span>{name}</span><Button variant="outline" size="sm" onClick={() => archived.includes(id) ? onRestore(id) : onArchive(id)}>{archived.includes(id) ? 'Restaurar' : 'Archivar'}</Button></div>)}{dataPage === 'archived' && archived.length === 0 && <p>No hay conversaciones archivadas.</p>}</SettingsSection><SettingsSection title="Exportar datos" description="Descarga únicamente los ejemplos y el historial generado en esta página."><Button variant="outline" onClick={exportData}>Exportar demo en JSON</Button><Button variant="ghost" onClick={() => { onReset(); setNotice('Chats de ejemplo restaurados.'); }}>Restaurar chats de ejemplo</Button><p>Importación, carpetas vinculadas y eliminación de archivos requieren la aplicación instalada.</p></SettingsSection></>}
        {tab === 'shortcuts' && <DemoShortcuts />}
        <div hidden={tab !== 'logs'}><DemoLogs theme={theme} profileName={profileName} /></div>
        {tab === 'about' && <SettingsSection title="Sparta Agent" description={`Versión ${release.version}`}><p>Conversaciones, proyectos y herramientas desde tu escritorio.</p><div className="demo-settings-links"><a href="?docs=quickstart">Documentación</a><a href={release.url} target="_blank" rel="noreferrer">Notas de la versión ↗</a><a href={`${repository}/issues`} target="_blank" rel="noreferrer">Reportar un problema ↗</a><a href={`${repository}/blob/main/LICENSE`} target="_blank" rel="noreferrer">Licencia ↗</a></div></SettingsSection>}
        {notice && <p role="status">{notice}</p>}<footer>Opciones locales de ejemplo · Sin cambios en el escritorio</footer>
      </main>
    </Dialog.Popup></Dialog.Portal>
  </Dialog.Root>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="demo-settings-toggle"><span>{label}</span><Switch aria-label={label} checked={checked} onCheckedChange={onChange} /></label>;
}
