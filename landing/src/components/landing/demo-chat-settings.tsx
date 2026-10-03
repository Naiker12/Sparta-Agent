import { HugeiconsIcon } from '@hugeicons/react';
import { Bookmark02Icon, Download01Icon, Folder01Icon, McpServerIcon, PencilRulerIcon, ShieldBanIcon } from '@hugeicons/core-free-icons';
import { Columns2 } from 'lucide-react';
import { SettingsSection } from '../../../../desktop/frontend-spartan/src/features/settings/components/settings-section';
import { DemoSettingRow, DemoSettingToggle } from './demo-setting-row';
import { useDemoPreferences } from './demo-preferences';
import { DemoResponseSettings } from './demo-settings-panels';

export function DemoChatSettings({ collapseThinking, onCollapseThinking, enterSends, onEnterSends, showAvatar, onShowAvatar, selectedModel }: { collapseThinking: boolean; onCollapseThinking: (value: boolean) => void; enterSends: boolean; onEnterSends: (value: boolean) => void; showAvatar: boolean; onShowAvatar: (value: boolean) => void; selectedModel: string }) {
  const { prefs, update } = useDemoPreferences();
  return <>
    <DemoResponseSettings selectedModel={selectedModel} />
    <SettingsSection title="Menú del chat" description="Fija elementos en el menú + del chat. Los demás pasarán a Más.">{([
      { id: 'mcp', label: 'MCP', icon: McpServerIcon }, { id: 'savedPrompts', label: 'Prompts guardados', icon: Bookmark02Icon },
      { id: 'compareChat', label: 'Comparar chats', icon: null }, { id: 'exportChat', label: 'Exportar chat', icon: Download01Icon },
      { id: 'canvas', label: 'Canvas', icon: PencilRulerIcon }, { id: 'projects', label: 'Proyectos', icon: Folder01Icon }, { id: 'bypassPermissions', label: 'Permisos de herramientas', icon: ShieldBanIcon },
    ] as const).map(item => <DemoSettingToggle key={item.id} label={item.label} icon={item.icon ? <HugeiconsIcon icon={item.icon} strokeWidth={2} /> : <Columns2 />} checked={prefs.plusPins[item.id]} onChange={value => update({ plusPins: { ...prefs.plusPins, [item.id]: value } })} />)}</SettingsSection>
    <SettingsSection title="Valores predeterminados del chat">
      <DemoSettingToggle label="Mostrar la sección Proyectos" description="Agrupa los chats de proyecto bajo Proyectos. Desactívalo para listarlos en Recientes." checked={prefs.showProjects} onChange={showProjects => update({ showProjects })} />
      <DemoSettingToggle label="Contraer el razonamiento de forma predeterminada" description="Mantén el razonamiento contraído mientras el modelo piensa. Puedes expandir cualquier bloque." checked={collapseThinking} onChange={onCollapseThinking} />
      <DemoSettingToggle label="Mostrar aviso del modelo" description="Muestra «Los LLM pueden cometer errores» bajo el cuadro de chat." checked={prefs.showDisclaimer} onChange={showDisclaimer => update({ showDisclaimer })} />
      <DemoSettingToggle label="Mostrar el modelo de respuesta" description="Muestra el modelo capturado al iniciar la respuesta del asistente." checked={prefs.showResponseModel} onChange={showResponseModel => update({ showResponseModel })} />
      <DemoSettingToggle label="Titular automáticamente los chats nuevos" description="En la demo se usa el inicio de tu primer mensaje como título." checked={prefs.autoTitle} onChange={autoTitle => update({ autoTitle })} />
      <DemoSettingToggle label="Compartir archivos en todo el proyecto" description="Define el ámbito mostrado para los adjuntos de ejemplo: proyecto o conversación." checked={prefs.shareAttachments} onChange={shareAttachments => update({ shareAttachments })} />
      <DemoSettingToggle label="Recordar los ajustes por modelo" description="Conserva temperatura, instrucciones y ajustes locales al cambiar el modelo de la demo." checked={prefs.rememberParams} onChange={rememberParams => update({ rememberParams })} />
      <DemoSettingRow label="Condensar pegados largos" description="Los pegados que alcancen este tamaño se presentan como un adjunto de texto en la demo."><select aria-label="Condensar pegados largos" value={prefs.pasteThreshold} onChange={event => update({ pasteThreshold: Number(event.target.value) })}>{[0, 2000, 4000, 8000, 16000].map(value => <option value={value} key={value}>{value || 'Desactivado'}</option>)}</select></DemoSettingRow>
      <DemoSettingToggle label="Avatar en el saludo" description="Muestra un avatar de Sparta en el saludo del chat." checked={showAvatar} onChange={onShowAvatar} />
      <DemoSettingToggle label="Enviar con Enter" description="Desactívalo para usar Enter como salto de línea." checked={enterSends} onChange={onEnterSends} />
    </SettingsSection>
    <SettingsSection title="Canvas" description="Las vistas HTML y su ejecución requieren la aplicación instalada. Esta demo no ejecuta documentos HTML."><DemoSettingToggle label="Contraer bloques HTML" description="El escritorio permite contraer automáticamente los documentos HTML." checked={false} onChange={() => {}} disabled /><DemoSettingToggle label="Permitir acceso de red en Canvas" description="El escritorio controla aquí la carga de scripts, estilos, fuentes y medios externos." checked={false} onChange={() => {}} disabled /></SettingsSection>
  </>;
}
