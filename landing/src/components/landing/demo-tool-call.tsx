import { useEffect, useState } from 'react';
import { FileText, Check, Loader, ChevronDown } from 'lucide-react';

/** Local tool-call fixture, matching the desktop's expandable input/output card. */
export function DemoToolCall({ path, content, running, cancelled }: { path: string; content: string; running: boolean; cancelled: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(running), [running]);
  return <details className="demo-tool-call aui-tool-fallback-root" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><FileText /><span>Leer archivo <code>read_file</code></span>
      <span className="demo-tool-call-status">{cancelled ? 'Detenido' : running ? 'En curso' : 'Completado'}</span>
      {running ? <Loader className="demo-tool-spinner" /> : cancelled ? null : <Check />}<ChevronDown />
    </summary>
    <div><strong>Entrada</strong><pre>{JSON.stringify({ path }, null, 2)}</pre>
      <strong>Salida</strong>{cancelled || running ? <p>{cancelled ? 'La ejecución se detuvo en esta demostración.' : 'Esperando resultado…'}</p> : <pre>{JSON.stringify({ path, content }, null, 2)}</pre>}
      <small>Llamada simulada · Sin acceso al disco</small>
    </div>
  </details>;
}
