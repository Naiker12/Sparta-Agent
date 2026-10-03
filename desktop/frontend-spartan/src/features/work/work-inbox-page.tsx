import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useWorkOverview } from "./hooks/use-work-overview";
import { WORK_FILTERS, WORK_STATUS_LABELS, visibleWork, workExplanation, workTitle, type WorkFilter } from "./work-view-model";

export function WorkInboxPage() {
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [query, setQuery] = useState("");
  const { runs, hasMore, loading, error, refresh } = useWorkOverview(offset);
  const visible = visibleWork(runs, filter, query);
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-5 md:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Bandeja de trabajo</h1><p className="text-muted-foreground">Mensajes pendientes, respuestas y trabajo que necesita revisión.</p></div>
      <Button variant="outline" onClick={refresh} disabled={loading}>Actualizar</Button>
    </header>
    <label className="flex flex-col gap-2 text-sm">Buscar en esta página<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mensaje, chat, proyecto o resultado" /></label>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar trabajo">{WORK_FILTERS.map((option) => <Button key={option.value} variant={filter === option.value ? "default" : "outline"} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</Button>)}</div>
    {error && <div role="alert" className="rounded-lg border p-4 text-destructive">{error}<Button variant="ghost" onClick={refresh}>Reintentar</Button></div>}
    {loading ? <p role="status">Consultando el trabajo…</p> : visible.length === 0 ? <section className="rounded-xl border border-dashed p-8 text-center"><h2 className="font-semibold">{runs.length ? "No hay coincidencias" : "Todavía no hay trabajo registrado"}</h2><p className="text-muted-foreground">{runs.length ? "Prueba otro filtro o término de búsqueda." : "Los mensajes de la cola aparecerán aquí cuando los guardes desde un chat."}</p></section> : <div className="flex flex-col gap-4">{visible.map((run) => <Card key={run.id}>
      <CardHeader><CardTitle className="break-words text-base">{workTitle(run)}</CardTitle><CardDescription>{run.project_name || "Sin proyecto"} · {run.thread_title || "Solicitud independiente"}</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-3"><p className="text-sm font-medium">{WORK_STATUS_LABELS[run.status]}</p><p className="text-sm text-muted-foreground">{workExplanation(run)}</p>{run.result?.summary && <p className="whitespace-pre-wrap break-words text-sm">{run.result.summary}</p>}</CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-3"><time className="text-xs text-muted-foreground" dateTime={new Date(run.updated_at).toISOString()}>{new Date(run.updated_at).toLocaleString()}</time>{run.source_thread_id && <Button variant="outline" asChild><Link to="/chat" search={{ thread: run.source_thread_id }}>Abrir chat</Link></Button>}</CardFooter>
    </Card>)}</div>}
    <nav className="flex items-center justify-between" aria-label="Páginas de trabajo"><Button variant="outline" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>Anterior</Button><span className="text-sm text-muted-foreground">Página {offset / 100 + 1} · filtros sobre esta página</span><Button variant="outline" disabled={loading || !hasMore} onClick={() => setOffset(offset + 100)}>Siguiente</Button></nav>
  </main>;
}
