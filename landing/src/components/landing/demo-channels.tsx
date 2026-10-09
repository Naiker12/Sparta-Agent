import { useState } from "react";
import { MessageSquare, Send, ShieldCheck, FileText } from "lucide-react";
import { getPublicUrl } from "@/lib/utils";
import { Button } from './desktop-demo-button';
import { DemoSettingToggle } from './demo-setting-row';
import { SettingsSection } from '../../../../desktop/frontend-spartan/src/features/settings/components/settings-section';
import { useDemoPreferences } from './demo-preferences';

export function DemoChannelsMenu({ active, onTelegram }: { active: boolean; onTelegram: () => void }) {
  return <button type="button" className="demo-channels" aria-label="Canales" aria-pressed={active} onClick={onTelegram}>
    <MessageSquare aria-hidden="true" /><span>Canales</span>
  </button>;
}

export function DemoTelegramPanel({ onSettings }: { onSettings: () => void }) {
  const [tab, setTab] = useState<'connections' | 'activity'>('connections');
  const [platform, setPlatform] = useState('Telegram');
  return <section className="workspace-explorer" aria-label="Canales de ejemplo">
    <div className="explorer-heading"><span><MessageSquare aria-hidden="true" /></span><div><h3>Canales</h3><p>Conecta tu cuenta y empieza a hablar con Sparta.</p></div></div>
    <div className="demo-channel-page">
    <nav className="demo-platform-navigation" aria-label="Tus canales">
      <strong>Tus canales</strong><small>Disponibles</small>
      <Button variant={platform === 'Telegram' ? 'secondary' : 'ghost'} aria-pressed={platform === 'Telegram'} onClick={() => setPlatform('Telegram')}><Send data-icon="inline-start" />Telegram</Button>
      <small>Próximamente</small>
      {['Discord', 'WhatsApp', 'Slack'].map(name => <Button key={name} variant={platform === name ? 'secondary' : 'ghost'} aria-pressed={platform === name} onClick={() => setPlatform(name)}>{name}<small>Próximamente</small></Button>)}
    </nav>
    <div className="demo-channel-page-content">
    {platform !== 'Telegram' ? <div className="explorer-card"><div className="explorer-card-title"><MessageSquare /><strong>{platform}</strong><span>Próximamente</span></div><p>Esta integración todavía no está disponible. Puedes empezar con Telegram.</p><Button variant="outline" onClick={() => setPlatform('Telegram')}>Ver Telegram</Button></div> : <>
    <div className="explorer-heading"><span><Send aria-hidden="true" /></span><div><h3>Telegram</h3><p>Sin conectar · Añade tu primer bot desde la aplicación de escritorio.</p></div></div>
    <div className="demo-settings-button-row" role="group" aria-label="Vistas de Telegram"><Button variant={tab === 'connections' ? 'secondary' : 'ghost'} aria-pressed={tab === 'connections'} onClick={() => setTab('connections')}>Conexiones</Button><Button variant={tab === 'activity' ? 'secondary' : 'ghost'} aria-pressed={tab === 'activity'} onClick={() => setTab('activity')}>Actividad</Button></div>
    {tab === 'activity' ? <div className="explorer-card"><div className="explorer-card-title"><CheckActivity /><strong>Actividad reciente</strong></div><p>Todavía no hay actividad.</p><div className="explorer-meta">Los eventos aparecerán aquí cuando conectes un bot.</div></div> : <>
    <div className="explorer-card">
      <div className="explorer-card-title"><Send aria-hidden="true" /><strong>Conecta tu primer bot</strong><span>Sin conectar</span></div>
      <ol className="demo-channel-steps">
        <li><strong>Crea el bot</strong><span>Abre BotFather y utiliza /newbot.</span></li>
        <li><strong>Elige tu asistente</strong><span>En Spartan, introduce el token y selecciona proveedor y modelo.</span></li>
        <li><strong>Vincula tu Telegram</strong><span>Abre el enlace y confirma la cuenta en la aplicación.</span></li>
      </ol>
      <Button variant="outline" onClick={onSettings}><ShieldCheck data-icon="inline-start" />Canales y permisos</Button><div className="demo-channel-links"><a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">Abrir BotFather</a><a href={getPublicUrl("?docs=features/channels")}>Ver guía de conexión</a></div>
    </div>
    <div className="explorer-card"><div className="explorer-card-title"><FileText aria-hidden="true" /><strong>Qué puedes hacer</strong></div><p>Conversar, buscar fuentes públicas y resumir documentos. Administra el perfil, los proyectos y la voz desde Configuración → Canales y permisos.</p></div>
    <div className="explorer-card"><div className="explorer-card-title"><ShieldCheck aria-hidden="true" /><strong>Tú autorizas el acceso</strong></div><p>Conversaciones privadas con usuarios autorizados. Spartan debe permanecer abierto. Discord, WhatsApp y Slack están próximos.</p></div>
    </>}
    </>}
    </div></div>
  </section>;
}

function CheckActivity() { return <MessageSquare aria-hidden="true" />; }

export function DemoChannelPermissions() {
  const { prefs, update } = useDemoPreferences();
  return <><SettingsSection title="Telegram" description="No hay cuentas de Telegram conectadas. Vincula una cuenta en la aplicación de escritorio para administrar sus permisos."><DemoSettingToggle label="Permitir cambiar mi nombre de perfil" disabled checked={false} onChange={channelProfile => update({ channelProfile })} /><DemoSettingToggle label="Acceso al proyecto sparta-demo" disabled checked={false} onChange={channelProject => update({ channelProject })} /><DemoSettingToggle label="Recibir notas de voz" disabled checked={false} onChange={channelVoice => update({ channelVoice })} /><p>En el escritorio, la voz requiere un proveedor de transcripción configurado. Los permisos de archivos y herramientas se comprueban al ejecutar cada acción.</p></SettingsSection><SettingsSection title="Avisos de automatizaciones"><p>Sin destino conectado. Vincula tu Telegram personal para recibir avisos de inicio y final.</p></SettingsSection></>;
}
