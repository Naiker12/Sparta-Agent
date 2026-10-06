import { useT as useUiT } from "@/i18n";
import { useEffect, useState } from "react";
export function ImageFileView({path, bytes, mime, onClose}: {path: string; bytes: Uint8Array; mime: string; onClose: () => void}) {
  const uiT = useUiT();

  const [url, setUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  useEffect(() => { const local = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], {type:mime})); setUrl(local); return () => URL.revokeObjectURL(local); }, [bytes,mime]);
  return <section className="flex h-full min-h-0 flex-col" aria-label={uiT("ui.image_preview")}>
    <header className="flex shrink-0 flex-col gap-2 border-b p-3 text-xs">
      <button type="button" onClick={onClose} className="text-left text-primary">{uiT("ui.files")}</button><p className="truncate" title={path}>{path.split(/[\\/]/).pop()}</p>
      <div className="flex items-center gap-3"><button type="button" aria-label={uiT("ui.zoom_out")} onClick={() => setZoom(z => Math.max(.25,z-.25))}>−</button><button type="button" onClick={() => setZoom(1)}>{uiT("ui.fit")}</button><button type="button" aria-label={uiT("ui.zoom_in")} onClick={() => setZoom(z => Math.min(4,z+.25))}>+</button><span>{Math.round(zoom*100)}%</span></div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto p-4">{url && <img src={url} alt={path.split(/[\\/]/).pop() ?? uiT("ui.image")} style={{width:`${zoom*100}%`,maxWidth:"none"}} className="h-auto object-contain" />}</div>
  </section>;
}
