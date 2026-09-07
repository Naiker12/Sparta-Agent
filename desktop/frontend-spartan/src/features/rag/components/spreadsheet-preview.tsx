import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/i18n";

type PreviewResult = { sheets: SheetData[]; limited?: boolean; error?: string };
const previewCache = new WeakMap<Blob, PreviewResult>();

type SheetData = { name: string; rows: string[][]; truncated: boolean };
export function LocalSpreadsheetPreview({ blob }: { blob: Blob }) {
  const t = useT();
  const [result, setResult] = useState<{blob: Blob; sheets: SheetData[]; limited?: boolean; error?: string} | null>(() => { const cached = previewCache.get(blob); return cached ? { ...cached, blob } : null; });
  const [selected, setSelected] = useState(() => String(Math.max(0, previewCache.get(blob)?.sheets.findIndex(sheet => sheet.rows.length > 0) ?? 0)));
  const [page, setPage] = useState(0);
  useEffect(() => {
    const cached = previewCache.get(blob);
    if (cached) return;
    const worker = new Worker(new URL("./spreadsheet-preview.worker.ts", import.meta.url), { type: "module" });
    const fail = (message: string) => { setResult({blob, sheets: [], error: message}); worker.terminate(); };
    const timer = window.setTimeout(() => fail(t("chat.preview.localSafetyError")), 15000);
    worker.onmessage = ({data}) => {
      clearTimeout(timer);
      const sheets: SheetData[] = data.sheets ?? [];
      if (!data.error) previewCache.set(blob, { ...data, sheets });
      setResult({ ...data, blob, sheets });
      setSelected(String(Math.max(0, sheets.findIndex(sheet => sheet.rows.length > 0))));
      setPage(0);
      worker.terminate();
    };
    worker.onerror = () => { clearTimeout(timer); fail(t("chat.preview.unsupportedSpreadsheet")); };
    worker.postMessage(blob);
    return () => { clearTimeout(timer); worker.terminate(); };
  }, [blob, t]);
  if (!result || result.blob !== blob) return <p className="p-6 text-sm text-muted-foreground" role="status">{t("chat.preview.loading")}</p>;
  if (result.error) return <p className="p-6 text-sm text-muted-foreground" role="alert">{t("chat.preview.spreadsheetError", {error: result.error})}</p>;
  const sheet = result.sheets[Number(selected)];
  const rows = sheet?.rows ?? [];
  const columns = Math.max(0, ...rows.map(row => row.length));
  const columnLabel = (index: number) => index < 26 ? String.fromCharCode(65 + index) : String.fromCharCode(64 + Math.floor(index / 26)) + String.fromCharCode(65 + index % 26);
  return <div className="flex h-full min-h-0 flex-col">
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs" aria-label={sheet?.name}>
        <thead className="sticky top-0 z-10 bg-muted"><tr><th className="border-b border-r p-2" scope="col">#</th>{Array.from({length:columns},(_,i)=><th key={i} scope="col" className="min-w-32 border-b border-r p-2 text-left font-medium">{columnLabel(i)}</th>)}</tr></thead>
        <tbody>{rows.slice(page*100,(page+1)*100).map((row,i)=><tr key={i} className="hover:bg-muted/50"><th scope="row" className="sticky left-0 border-b border-r bg-muted px-3 py-2 font-normal text-muted-foreground">{page*100+i+1}</th>{Array.from({length:columns},(_,j)=><td key={j} className="max-w-96 whitespace-pre-wrap break-words border-b border-r px-3 py-2 align-top">{row[j] ?? ""}</td>)}</tr>)}</tbody>
      </table>
      {!rows.length && <p className="p-6 text-sm text-muted-foreground">{t("chat.preview.emptySpreadsheet")}</p>}
    </div>
    <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
      <span>{rows.length} × {columns}{sheet?.truncated || result.limited ? ` · ${t("chat.preview.spreadsheetLimit")}` : ""}</span>
      <div className="flex items-center gap-1"><Button size="icon-sm" variant="ghost" disabled={page===0} aria-label={t("chat.preview.previousPage")} onClick={()=>setPage(p=>p-1)}>‹</Button><span>{page+1} / {Math.max(1,Math.ceil(rows.length/100))}</span><Button size="icon-sm" variant="ghost" disabled={(page+1)*100>=rows.length} aria-label={t("chat.preview.nextPage")} onClick={()=>setPage(p=>p+1)}>›</Button></div>
    </div>
    <Tabs value={selected} onValueChange={value=>{setSelected(value);setPage(0);}} className="overflow-x-auto border-t p-2"><TabsList>{result.sheets.map((item,i)=><TabsTrigger key={i} value={String(i)}>{item.name}</TabsTrigger>)}</TabsList></Tabs>
  </div>;
}
