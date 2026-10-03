import { useEffect, useState, type RefObject } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { AttachmentIcon, Delete02Icon } from '@hugeicons/core-free-icons';
import { X } from 'lucide-react';
import { useDemoPreferences } from './demo-preferences';

export function DemoAttachmentInput({ inputRef, onFiles }: { inputRef: RefObject<HTMLInputElement | null>; onFiles: (files: File[]) => void }) {
  return <input ref={inputRef} type="file" multiple tabIndex={-1} className="sr-only" aria-label="Seleccionar archivos locales de la demo" onChange={event => { onFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />;
}

export function DemoAttachmentTray({ files, onRemove, theme }: { files: File[]; onRemove?: (index: number) => void; theme: string }) {
  const { style, prefs } = useDemoPreferences();
  const [selected, setSelected] = useState<File | null>(null);
  const [content, setContent] = useState('');
  const [image, setImage] = useState('');
  useEffect(() => {
    if (!selected) return;
    let current = true;
    setContent(''); setImage('');
    if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(selected.type)) {
      const url = URL.createObjectURL(selected); setImage(url);
      return () => { current = false; URL.revokeObjectURL(url); };
    }
    if ((selected.type.startsWith('text/') || /\.(md|txt|json|csv|tsx?|jsx?|py|css|html|yaml|yml|xml|log)$/i.test(selected.name)) && selected.size <= 1_000_000) {
      setContent('Leyendo vista previa…');
      void selected.text().then(text => { if (current) setContent(text.slice(0, 10000) || 'Archivo vacío.'); }).catch(() => { if (current) setContent('No se pudo leer este archivo.'); });
    } else setContent('Vista previa no disponible para este formato o tamaño. El archivo permanece local.');
    return () => { current = false; };
  }, [selected]);
  if (files.length === 0) return null;
  return <>
    <div className="demo-local-attachments">{files.map((file, index) => <div className="demo-local-attachment" key={`${index}:${file.name}`}><button type="button" aria-label={`Ver adjunto ${file.name}`} onClick={() => setSelected(file)}><HugeiconsIcon icon={AttachmentIcon} /><span>{file.name}<small>{file.size < 1024 ? `${file.size} B` : `${Math.ceil(file.size / 1024)} KB`} · {prefs.shareAttachments ? 'Proyecto' : 'Conversación'}</small></span></button>{onRemove && <button type="button" aria-label={`Quitar adjunto ${file.name}`} onClick={() => onRemove(index)}><HugeiconsIcon icon={Delete02Icon} /></button>}</div>)}</div>
    <Dialog.Root open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}><Dialog.Portal><Dialog.Backdrop className="demo-message-backdrop" /><Dialog.Popup className="sparta-preview demo-message-dialog demo-attachment-dialog" data-demo-theme={theme} style={style}><header><Dialog.Title>{selected?.name}</Dialog.Title><Dialog.Close aria-label="Cerrar vista previa del adjunto"><X /></Dialog.Close></header><Dialog.Description>Vista previa local. Este archivo no se envía a un proveedor ni se ejecuta.</Dialog.Description>{image ? <img className="demo-attachment-image" src={image} alt={`Vista previa de ${selected?.name}`} /> : <pre>{content}</pre>}<small>Los archivos de texto muestran hasta 10 000 caracteres.</small></Dialog.Popup></Dialog.Portal></Dialog.Root>
  </>;
}
