import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { AttachmentIcon, CodeIcon, Image03Icon, McpServerIcon, Bookmark02Icon, Download01Icon, PencilRulerIcon, Folder01Icon, ShieldBanIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Plus, Globe, Check, ChevronDown, RotateCcw, Columns2 } from 'lucide-react';
import { useDemoPreferences } from './demo-preferences';
import { Switch } from '../../../../desktop/frontend-spartan/src/components/ui/switch';

export type DemoTools = { web: boolean; code: boolean; images: boolean; mcp: boolean };
const options = [
  { id: 'web', label: 'Búsqueda web', icon: Globe },
  { id: 'code', label: 'Ejecución de código', icon: CodeIcon },
  { id: 'images', label: 'Generación de imágenes', icon: Image03Icon },
  { id: 'mcp', label: 'Herramientas MCP', icon: McpServerIcon },
] as const;

export function DemoToolsMenu({ tools, onToggle, onAttach, onPrompt, theme, onExport, onProject, onPermissions }: {
  tools: DemoTools; onToggle: (key: keyof DemoTools) => void;
  onAttach: () => void; onPrompt: () => void;
  theme: string;
  onExport: () => void; onProject: () => void; onPermissions: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { prefs, style } = useDemoPreferences();
  const entries = [
    { id: 'mcp', label: 'MCP', icon: McpServerIcon, run: () => onToggle('mcp'), disabled: false },
    { id: 'savedPrompts', label: 'Prompts guardados', icon: Bookmark02Icon, run: onPrompt, disabled: false },
    { id: 'compareChat', label: 'Comparar chats', icon: Columns2, run: () => {}, disabled: true },
    { id: 'exportChat', label: 'Exportar chat', icon: Download01Icon, run: onExport, disabled: false },
    { id: 'canvas', label: 'Canvas', icon: PencilRulerIcon, run: () => {}, disabled: true },
    { id: 'projects', label: 'Proyectos', icon: Folder01Icon, run: onProject, disabled: false },
    { id: 'bypassPermissions', label: 'Permisos de herramientas', icon: ShieldBanIcon, run: onPermissions, disabled: false },
  ] as const;
  const renderEntry = (item: typeof entries[number]) => <button type="button" key={item.id} disabled={item.disabled} title={item.disabled ? 'Disponible en la aplicación de escritorio' : undefined} aria-pressed={item.id === 'mcp' ? tools.mcp : undefined} onClick={() => { item.run(); if (item.id !== 'mcp') setOpen(false); }}>{item.id === 'compareChat' ? <item.icon /> : <HugeiconsIcon icon={item.icon} strokeWidth={1.75} />}{item.label}{item.id === 'mcp' && tools.mcp && <Check className="demo-option-check" />}</button>;
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger className="demo-attachment" aria-label="Herramientas y adjuntos"><Plus /></Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="top" align="start" sideOffset={8}>
      <Popover.Popup className="sparta-preview demo-composer-popover" data-demo-theme={theme} style={style}>
        <Popover.Title>Herramientas y adjuntos</Popover.Title>
        <button type="button" onClick={() => { onAttach(); setOpen(false); }}><HugeiconsIcon icon={AttachmentIcon} />Añadir fotos y archivos</button>
        {options.filter(item => item.id !== 'mcp').map(item => <button type="button" key={item.id} aria-pressed={tools[item.id]} onClick={() => onToggle(item.id)}>{item.id === 'web' ? <item.icon /> : <HugeiconsIcon icon={item.icon} strokeWidth={1.75} />}{item.label}{tools[item.id] && <Check className="demo-option-check" />}</button>)}
        {entries.filter(item => prefs.plusPins[item.id]).map(renderEntry)}
        <details className="demo-tool-more"><summary>Más</summary>{entries.filter(item => !prefs.plusPins[item.id]).map(renderEntry)}</details>
        <Popover.Description>Opciones locales de ejemplo. No se ejecutan servicios externos.</Popover.Description>
      </Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}

export function DemoToolPills({ tools, onToggle }: { tools: DemoTools; onToggle: (key: keyof DemoTools) => void }) {
  return <div className="demo-tool-pills">{options.filter(item => tools[item.id]).map(item => <button type="button" key={item.id} aria-label={`Desactivar ${item.label}`} onClick={() => onToggle(item.id)}>{item.id === 'web' ? <item.icon /> : <HugeiconsIcon icon={item.icon} strokeWidth={1.75} />}{item.label}<span aria-hidden="true">×</span></button>)}</div>;
}

export function DemoReasoningOption({ enabled, onChange, model, locked, theme }: {
  enabled: boolean; onChange: (enabled: boolean) => void; model: string; locked: boolean;
  theme: string;
}) {
  const { style } = useDemoPreferences();
  return <Popover.Root>
    <Popover.Trigger className="demo-reasoning-selector" aria-label={`Razonamiento: ${enabled ? 'Activado' : 'Desactivado'}`}><span>{enabled ? 'Activado' : 'Desactivado'}</span><ChevronDown /></Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="top" align="end" sideOffset={8}><Popover.Popup className="sparta-preview demo-composer-popover demo-reasoning-options" data-demo-theme={theme} style={style}>
      <header><Popover.Title>Razonamiento</Popover.Title><button type="button" aria-label="Restablecer razonamiento" onClick={() => onChange(true)}><RotateCcw /></button></header>
      <p>{model}</p>
      <label><span>Activar razonamiento</span><Switch aria-label="Activar razonamiento" checked={enabled} disabled={locked} onCheckedChange={onChange} /></label>
      <Popover.Description>{locked ? 'Este modelo requiere razonamiento.' : 'Más razonamiento puede aumentar el tiempo de respuesta. Elige cómo recorrer la demo.'}</Popover.Description>
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}
