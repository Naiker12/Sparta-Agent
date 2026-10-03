import { DemoFileTree } from './demo-file-tree';
import { DemoBrowserPreview } from './demo-browser-preview';
import { Bot, Check, FileCode, Folder, GitBranch, Github, Globe, PanelRightClose, Search, RefreshCw, Copy } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from "./desktop-demo-button";
import { cn } from '@/lib/utils';
import { DemoFileDiff } from './demo-file-diff';
import { DesktopStreamingMessage } from './desktop-streaming-message';

export const sheetTabs = [{id:'files',label:'Explorador de archivos',icon:Folder},{id:'changes',label:'Cambios de archivos',icon:GitBranch},{id:'github',label:'GitHub',icon:Github},{id:'agents',label:'Subagentes',icon:Bot},{id:'browser',label:'Vista previa web',icon:Globe}] as const;
export type SheetTab = typeof sheetTabs[number]['id'];
export function WorkspaceRail({tab,open,available,onSelect}:{tab:SheetTab;open:boolean;available:readonly SheetTab[];onSelect:(tab:SheetTab)=>void}) {
  return <nav className="demo-workspace-rail" aria-label="Paneles del espacio de trabajo">{sheetTabs.filter(item => available.includes(item.id)).map(item=><Button variant="ghost" size="icon" key={item.id} aria-label={item.label} title={item.label} aria-pressed={open&&tab===item.id} onClick={()=>onSelect(item.id)}><item.icon /></Button>)}</nav>;
}
export function WorkspaceSheet({tab,folder,file,sourceFiles,lines,approved,fileRequest,onClose}:{tab:SheetTab;folder:string;file:string;sourceFiles:readonly string[];lines:string[];approved:boolean;fileRequest:number;onClose:()=>void}) {
  const [selected,setSelected] = useState('');
  const [query,setQuery] = useState('');
  const [notice,setNotice] = useState('');
  const [wrapLines,setWrapLines] = useState(false);
  const [mode,setMode] = useState<'original'|'proposed'|'preview'>('original');
  useEffect(()=>{setSelected(file);setQuery('');setMode(fileRequest ? 'proposed' : 'original');setNotice('');},[file,fileRequest]);
  const [panelWidth, setPanelWidth] = useState(300);
  const resize = (width: number) => setPanelWidth(Math.min(480, Math.max(280, width)));
  const title = sheetTabs.find(item=>item.id===tab)?.label;
  const files = [...new Set([file, ...sourceFiles])];
  const current = files.includes(selected) ? selected : file;
  const diffLines = file.endsWith('.diff') ? lines.filter(line=>! /^(Archivo:|Alcance:|Estado:)/.test(line)) : lines;
  const additions = diffLines.filter(line=>line.startsWith('+')).length;
  const deletions = diffLines.filter(line=>line.startsWith('-')).length;
  const hasChanges = additions + deletions > 0;
  const contentLines = diffLines.filter(line => mode === 'original' ? !line.startsWith('+') : !line.startsWith('-')).map(line => /^[+-]/.test(line) ? line.slice(1) : line);
  const fixtures: Record<string, string[]> = {
    'brief.md': ['# Brief del proyecto', '', 'Simplificar el formulario.', 'Mantener una sola acción principal.'],
    'reunion.md': ['# Decisiones de la reunión', '', 'Revisar los mensajes de error.', 'Probar el recorrido completo del formulario.'],
    'validation.ts': ['export function validateEmail(email: string) {', '  return email.includes("@");', '}'],
    'contact-form.tsx': ['const emailError = validateEmail(email);', approved ? '<span>Escribe un correo válido.</span>' : '<span>Entrada inválida</span>', 'return <ContactForm errors={errors} />;'],
  };
  const currentLines = current === file ? contentLines : fixtures[current] ?? ['Archivo de ejemplo sin contenido disponible.'];
  return <aside className="demo-workspace-sheet" data-wrap-lines={wrapLines} aria-label="Panel lateral de ejemplo" style={{ '--demo-panel-width': `${panelWidth}px` } as CSSProperties}>
    <div className="demo-sheet-resize" role="separator" aria-label="Redimensionar panel de archivos" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={480} aria-valuenow={panelWidth} tabIndex={0}
      onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); resize(panelWidth + 24); } if (event.key === 'ArrowRight') { event.preventDefault(); resize(panelWidth - 24); } }}
      onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) { const right = event.currentTarget.parentElement?.getBoundingClientRect().right; if (right !== undefined) resize(right - event.clientX); } }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />
    <header><strong>{title}</strong><Button variant="ghost" size="icon" aria-label="Cerrar panel lateral" onClick={onClose}><PanelRightClose /></Button></header>
    {(tab==='files' || tab==='changes') && <div className="demo-file-modes"><button type="button" aria-pressed={wrapLines} onClick={()=>setWrapLines(value=>!value)}>Ajustar líneas</button></div>}
    {tab==='files' && <><div className="sheet-folder"><Folder />{folder}<Button variant="ghost" size="icon" aria-label="Actualizar archivos de ejemplo" onClick={() => { setQuery(''); setNotice('Archivos de ejemplo actualizados'); }}><RefreshCw /></Button></div><label className="sheet-search"><Search /><input aria-label="Buscar archivo de ejemplo" placeholder="Buscar archivos…" value={query} onChange={event => setQuery(event.target.value)} /></label><DemoFileTree files={files} query={query} current={current} onSelect={name=>{setSelected(name);setNotice('');setMode(name.endsWith('.md') ? 'preview' : 'original');}} /><div className="sheet-code-heading"><FileCode />{current}<Button variant="ghost" size="icon" aria-label="Copiar contenido del archivo de ejemplo" onClick={async()=>{try{await navigator.clipboard.writeText(currentLines.join('\n'));setNotice('Contenido copiado');}catch{setNotice('No se pudo copiar el contenido');}}}><Copy /></Button></div><div className="demo-file-modes" role="group" aria-label="Vista del archivo">{current===file && hasChanges && <><button type="button" aria-pressed={mode==='original'} onClick={()=>setMode('original')}>Original</button><button type="button" aria-pressed={mode==='proposed'} onClick={()=>setMode('proposed')}>Propuesta</button></>}{current.endsWith('.md') && <><button type="button" aria-pressed={mode==='original'} onClick={()=>setMode('original')}>Código</button><button type="button" aria-pressed={mode==='preview'} onClick={()=>setMode('preview')}>Vista previa</button></>}</div>{mode==='preview' && current.endsWith('.md') ? <div className="demo-file-markdown"><DesktopStreamingMessage text={currentLines.join('\n')} running={false} messageId={`file:${current}`} /></div> : <Code lines={currentLines} approved={approved} />}</>}
    {tab==='changes' && <><div className="sheet-status"><GitBranch /><div><strong>Cambios propuestos</strong><span>{hasChanges ? '1 archivo · Datos de ejemplo' : 'Sin cambios de código'}</span></div></div><div className="sheet-change-file"><FileCode />{file.endsWith('.diff') ? sourceFiles[0] || file : file}<span>+{additions} −{deletions}</span></div>{hasChanges ? <DemoFileDiff lines={diffLines} /> : <p className="sheet-empty">No hay diferencias de código para mostrar.</p>}</>}
    {tab==='github' && <div className="sheet-overview"><Github /><h3>Repositorio del proyecto</h3><p>sparta-demo · origin/main</p><div className="sheet-status"><Check /><span>Vista de ejemplo de la conexión</span></div><h4>Últimos cambios</h4><div className="sheet-commit"><GitBranch /><span>Mejorar mensajes del formulario<small>Propuesta para revisar</small></span></div></div>}
    {tab==='agents' && <div className="sheet-overview"><h3>Subagentes</h3><p>Tareas y agentes especializados.</p>{[['Code Reviewer','Revisión de la propuesta','Completado'],['Research Agent','Contexto del proyecto','Disponible']].map(([name,role,status])=><div className="sheet-agent" key={name}><Bot /><div><strong>{name}</strong><small>{role}</small></div><span>{status}</span></div>)}</div>}
    {tab==='browser' && <DemoBrowserPreview approved={approved} />}
    {notice && <p className="sheet-empty" role="status">{notice}</p>}<div className="sheet-example-note"><Check />{approved ? 'Aprobación simulada' : 'Datos de ejemplo · Sin cambios reales'}</div>
  </aside>;
}
function Code({lines,approved}:{lines:string[];approved:boolean}) { return <pre className="sheet-code">{lines.map((line,index)=><span key={index} className={cn(line.startsWith('+')&&'line-added',line.startsWith('-')&&'line-removed')}><i aria-hidden="true">{index+1}</i><code>{approved&&line.startsWith('Estado:') ? 'Estado: aprobado en la demo' : line||' '}</code></span>)}</pre>; }
