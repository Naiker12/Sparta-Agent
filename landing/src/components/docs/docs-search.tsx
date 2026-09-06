import { useMemo, useState } from 'react';
import { SearchDialog, SearchDialogContent, SearchDialogHeader, SearchDialogInput, SearchDialogList, SearchDialogOverlay, SearchDialogClose, type SharedProps } from 'fumadocs-ui/components/dialog/search';
import { catalog } from './lib/catalog.generated';
import { docsPath } from './lib/navigation';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
export default function DocsSearch(props: SharedProps) {
  const [search, setSearch] = useState('');
  const items = useMemo(() => {
    const terms = normalize(search).trim().split(/\s+/).filter(Boolean);
    return catalog.map(page => {
      const haystack = normalize(`${page.title} ${page.description} ${page.text}`);
      const score = terms.every(term => haystack.includes(term)) ? terms.reduce((n, term) => n + (normalize(page.title).includes(term) ? 5 : 1), 0) : -1;
      return { page, score };
    }).filter(({ score }) => score >= 0).sort((a, b) => b.score - a.score).slice(0, 12).map(({ page }) => ({
      id: page.slug, type: 'page' as const, content: page.title, url: docsPath(page.slug),
    }));
  }, [search]);
  return <SearchDialog {...props} search={search} onSearchChange={setSearch}>
    <SearchDialogOverlay />
    <SearchDialogContent>
      <SearchDialogHeader><SearchDialogInput placeholder="Busca una guía, función o problema…" /><SearchDialogClose /></SearchDialogHeader>
      <SearchDialogList items={items} Empty={() => <p className="p-6 text-sm text-fd-muted-foreground">Sin resultados. Prueba con «modelo», «permisos» o «terminal».</p>} />
      <p className="border-t border-fd-border px-4 py-3 text-xs text-fd-muted-foreground">↑ ↓ para navegar · Enter para abrir · Esc para cerrar</p>
    </SearchDialogContent>
  </SearchDialog>;
}
