import { useDemoPreferences } from './demo-preferences';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Menu } from '@base-ui/react/menu';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, Delete02Icon, Edit03Icon, Tick02Icon, Download01Icon, HelpCircleIcon } from '@hugeicons/core-free-icons';
import { RefreshCw, MoreHorizontal, GitBranch, X, Clock } from 'lucide-react';
import { Button } from './desktop-demo-button';

export function DemoMessageActions({ text, model, onRegenerate, onEdit, onDelete, onFork, theme }: {
  text: string; model: string; onRegenerate: () => void;
  onEdit: (text: string) => void; onDelete: () => void; onFork: () => void;
  theme: string;
}) {
  const { style, prefs } = useDemoPreferences();
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<'edit' | 'details' | null>(null);
  const [draft, setDraft] = useState(text);
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (reset.current) clearTimeout(reset.current); }, []);
  return <>
    <div className="demo-response-actions aui-assistant-action-bar-root" aria-label="Acciones de respuesta">
      <Button variant="ghost" size="icon" title={copied ? 'Copiado' : 'Copiar'} aria-label={copied ? 'Copiado' : 'Copiar respuesta'} onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setNotice('');
          if (reset.current) clearTimeout(reset.current);
          reset.current = setTimeout(() => setCopied(false), 2000);
        } catch { setNotice('No se pudo copiar. Selecciona el texto para copiarlo.'); }
      }}><HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} strokeWidth={1.75} /></Button>
      <Button variant="ghost" size="icon" title="Editar" aria-label="Editar respuesta" onClick={() => { setDraft(text); setDialog('edit'); }}><HugeiconsIcon icon={Edit03Icon} strokeWidth={1.75} /></Button>
      <Button variant="ghost" size="icon" title="Regenerar" aria-label="Regenerar respuesta" onClick={onRegenerate}><RefreshCw strokeWidth={1.75} /></Button>
      <Button variant="ghost" size="icon" title="Eliminar" aria-label="Eliminar respuesta de ejemplo" onClick={onDelete}><HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} /></Button>
      <Menu.Root><Menu.Trigger className="demo-message-more" title="Más acciones" aria-label="Más acciones de respuesta"><MoreHorizontal strokeWidth={1.75} /></Menu.Trigger>
        <Menu.Portal><Menu.Positioner side="top" align="start" sideOffset={6}><Menu.Popup className="sparta-preview demo-sidebar-popover demo-response-menu" data-demo-theme={theme} style={style}>
          <Menu.Item onClick={onFork}><GitBranch />Bifurcar en un nuevo chat</Menu.Item>
          <Menu.Item onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
            const link = document.createElement('a'); link.href = url; link.download = 'sparta-respuesta-demo.md'; link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}><HugeiconsIcon icon={Download01Icon} />Exportar Markdown</Menu.Item>
          <Menu.Item onClick={() => setDialog('details')}><HugeiconsIcon icon={HelpCircleIcon} />Ver detalles de la respuesta</Menu.Item>
        </Menu.Popup></Menu.Positioner></Menu.Portal>
      </Menu.Root>
      <button type="button" className="demo-message-timing" aria-label="Ver detalles de la respuesta" onClick={() => setDialog('details')}><Clock />Detalles</button>
    </div>
    {prefs.showResponseModel && <small className="demo-response-model">{model}</small>}
    {notice && <p role="status" className="demo-disclosure">{notice}</p>}
    <Dialog.Root open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}>
      <Dialog.Portal><Dialog.Backdrop className="demo-message-backdrop" /><Dialog.Popup className="sparta-preview demo-message-dialog" data-demo-theme={theme} style={style}>
        <header><Dialog.Title>{dialog === 'edit' ? 'Editar respuesta' : 'Detalles de la respuesta'}</Dialog.Title><Dialog.Close aria-label="Cerrar"><X /></Dialog.Close></header>
        <Dialog.Description>Demostración local · No modifica una conversación del escritorio.</Dialog.Description>
        {dialog === 'edit' ? <form onSubmit={event => { event.preventDefault(); if (draft.trim()) { onEdit(draft.trim()); setDialog(null); } }}>
          <label htmlFor="demo-reply-edit">Contenido de la respuesta</label><textarea id="demo-reply-edit" value={draft} onChange={event => setDraft(event.target.value)} rows={8} />
          <div className="demo-edit-actions"><Button variant="ghost" onClick={()=>setDialog(null)}>Cancelar</Button><Button type="submit" disabled={!draft.trim()}>Guardar respuesta</Button></div>
        </form> : <dl><dt>Modelo mostrado</dt><dd>{model}</dd><dt>Origen</dt><dd>Fragmentos locales de ejemplo</dd><dt>Renderizado</dt><dd>Streamdown y pipeline Markdown del escritorio</dd><dt>Contenido</dt><dd>{text.length} caracteres · Sin consumo de API</dd></dl>}
      </Dialog.Popup></Dialog.Portal>
    </Dialog.Root>
  </>;
}
