import { useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FileCode, FileText } from 'lucide-react';
export function DemoFileTree({files,query,current,onSelect}:{files:string[];query:string;current:string;onSelect:(name:string)=>void}) {
  const [closed,setClosed] = useState<string[]>([]);
  const matches=files.filter(name=>name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="sheet-file-list"><p className="sheet-empty">Carpetas de ejemplo</p>{['src','documentos','propuestas'].map(group=>{
    const entries=matches.filter(name=>(name.endsWith('.md') ? 'documentos' : name.endsWith('.diff') ? 'propuestas' : 'src')===group);
    if(!entries.length)return null;
    const open=Boolean(query)||!closed.includes(group);
    return <div key={group}><button type="button" aria-label={`Carpeta ${group}`} aria-expanded={open} onClick={()=>setClosed(old=>old.includes(group)?old.filter(name=>name!==group):[...old,group])}>{open?<ChevronDown/>:<ChevronRight/>}<Folder/>{group}</button>{open&&entries.map(name=><button className="demo-tree-file" type="button" key={name} aria-pressed={current===name} onClick={()=>onSelect(name)}>{name.endsWith('.md')?<FileText/>:<FileCode/>}<span>{name}</span></button>)}</div>;
  })}{!matches.length&&<p className="sheet-empty" role="status">No hay archivos que coincidan.</p>}</div>;
}
