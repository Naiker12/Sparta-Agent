import { useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { Dialog } from '@base-ui/react/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { PinIcon, PinOffIcon, MoreHorizontalIcon, Edit03Icon, Archive01Icon, BubbleChatIcon, Settings02Icon } from '@hugeicons/core-free-icons';
import { X } from 'lucide-react';
import { Button } from './desktop-demo-button';
import { useDemoPreferences } from './demo-preferences';
import { DEMO_NAV_ITEMS, type DemoNavId } from './demo-navigation-items';

type DemoNavDestination = Exclude<DemoNavId, 'audio' | 'export'>;
export function DemoPinnedNavigation({ active, onNavigate, onExport }: { active: string; onNavigate: (id: DemoNavDestination) => void; onExport: () => void }) {
  const { prefs } = useDemoPreferences();
  return <>{prefs.navOrder.filter(id => prefs.navPins[id]).map(id => {
    const item = DEMO_NAV_ITEMS.find(value => value.id === id)!;
    return <button type="button" key={id} disabled={id === 'audio'} aria-label={item.label} title={id === 'audio' ? 'Disponible en el escritorio' : item.label} aria-pressed={active === id} onClick={() => { if (id === 'export') onExport(); else if (id !== 'audio') onNavigate(id); }}><HugeiconsIcon icon={item.icon} strokeWidth={1.75} /><span>{item.label}</span></button>;
  })}</>;
}
export function DemoMoreMenu({ theme, onNavigate, onExport, onCustomize }: { theme: string; onNavigate: (id: DemoNavDestination) => void; onExport: () => void; onCustomize: () => void }) {
  const { style, prefs } = useDemoPreferences();
  return <Menu.Root><Menu.Trigger className="demo-more-trigger" aria-label="Más secciones"><span aria-hidden="true">···</span><span>Más</span></Menu.Trigger>
    <Menu.Portal><Menu.Positioner side="right" align="start" sideOffset={6}><Menu.Popup className="sparta-preview demo-sidebar-popover" data-demo-theme={theme} style={style}>
      {prefs.navOrder.filter(id => !prefs.navPins[id]).map(id => {
        const item = DEMO_NAV_ITEMS.find(value => value.id === id)!;
        return <Menu.Item key={id} disabled={id === 'audio'} onClick={() => { if (id === 'export') onExport(); else if (id !== 'audio') onNavigate(id); }}><HugeiconsIcon icon={item.icon} strokeWidth={1.75} /><span>{item.label}</span>{id === 'memory' && <small>Nuevo</small>}{id === 'audio' && <small>Escritorio</small>}</Menu.Item>;
      })}
      <Menu.Separator /><Menu.Item onClick={onCustomize}><HugeiconsIcon icon={Settings02Icon} strokeWidth={1.75} />Personalizar la barra…</Menu.Item>
    </Menu.Popup></Menu.Positioner></Menu.Portal>
  </Menu.Root>;
}

export function DemoChatRow({ name, selected, pinned, theme, onSelect, onPin, onRename, onArchive }: {
  name: string; selected: boolean; pinned: boolean; theme: string; onSelect: () => void; onPin: () => void; onRename: (name: string) => void; onArchive: () => void;
}) {
  const { style } = useDemoPreferences();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const rename = () => { setDraft(name); setRenaming(true); };
  return <div className="demo-chat-row" data-selected={selected}>
    <button type="button" className="demo-chat-select" aria-label={name} aria-pressed={selected} onClick={onSelect}><HugeiconsIcon icon={BubbleChatIcon} strokeWidth={1.75} /><span>{name}</span><small>gratis</small></button>
    <div className="demo-chat-row-actions">
      <button type="button" title={pinned ? 'Desfijar chat' : 'Fijar chat'} aria-label={`${pinned ? 'Desfijar' : 'Fijar'} ${name}`} onClick={onPin}><HugeiconsIcon icon={pinned ? PinOffIcon : PinIcon} strokeWidth={1.75} /></button>
      <Menu.Root><Menu.Trigger aria-label={`Más acciones de ${name}`} title="Más acciones"><HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={1.75} /></Menu.Trigger>
        <Menu.Portal><Menu.Positioner side="bottom" align="start" sideOffset={4}><Menu.Popup className="sparta-preview demo-sidebar-popover" data-demo-theme={theme} style={style}>
          <Menu.Item onClick={rename}><HugeiconsIcon icon={Edit03Icon} strokeWidth={1.75} />Renombrar</Menu.Item>
          <Menu.Item onClick={onPin}><HugeiconsIcon icon={pinned ? PinOffIcon : PinIcon} strokeWidth={1.75} />{pinned ? 'Desfijar' : 'Fijar'}</Menu.Item>
          <Menu.Item onClick={onArchive}><HugeiconsIcon icon={Archive01Icon} strokeWidth={1.75} />Archivar ejemplo</Menu.Item>
        </Menu.Popup></Menu.Positioner></Menu.Portal>
      </Menu.Root>
      <button type="button" title="Renombrar chat" aria-label={`Renombrar ${name}`} onClick={rename}><HugeiconsIcon icon={Edit03Icon} strokeWidth={1.75} /></button>
    </div>
    <Dialog.Root open={renaming} onOpenChange={setRenaming}><Dialog.Portal><Dialog.Backdrop className="demo-message-backdrop" /><Dialog.Popup className="sparta-preview demo-message-dialog" data-demo-theme={theme} style={style}>
      <header><Dialog.Title>Renombrar chat</Dialog.Title><Dialog.Close aria-label="Cerrar diálogo de nombre"><X /></Dialog.Close></header>
      <Dialog.Description>El nombre cambia solo en esta demo.</Dialog.Description>
      <form onSubmit={event => { event.preventDefault(); if (draft.trim()) { onRename(draft.trim()); setRenaming(false); } }}><label htmlFor={`demo-chat-name-${name}`}>Nombre del chat</label><input id={`demo-chat-name-${name}`} value={draft} maxLength={60} onChange={event => setDraft(event.target.value)} /><Button type="submit" disabled={!draft.trim()}>Guardar nombre</Button></form>
    </Dialog.Popup></Dialog.Portal></Dialog.Root>
  </div>;
}
