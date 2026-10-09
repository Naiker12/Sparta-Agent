import { Component, lazy, Suspense, useEffect, useMemo, type ComponentType, type ReactNode, type ComponentProps } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FrameworkProvider } from 'fumadocs-core/framework';
import { docsTree as tree } from './docs-navigation';
import { RootProvider } from 'fumadocs-ui/provider/base';
import { DocsBody, DocsDescription, DocsPage as FumadocsPage, DocsTitle } from 'fumadocs-ui/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { ExternalLink, FileText, ChevronRight } from 'lucide-react';
import { catalog } from './lib/catalog.generated';
import { canonicalSlug, docsHref, docsPath } from './lib/navigation';
import './docs.css';
import type { SharedProps } from 'fumadocs-ui/components/dialog/search';

import { release } from '@/lib/releases';
import { DocsDiagram } from './diagrams/docs-diagram';
import { DocsVideo } from './docs-video';

const LazySearchDialog = lazy(() => import('./docs-search'));
function SearchDialog(props: SharedProps) {
  return <Suspense fallback={null}><LazySearchDialog {...props} /></Suspense>;
}
const documents = import.meta.glob('./content/pages/**/*.mdx');
const mdxComponents = { ...defaultMdxComponents, Tabs, Tab, Steps, Step, DocsVideo, DocsDiagram };

function DocsLink({ href = '', prefetch: _prefetch, onClick, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) {
  const navigate = useNavigate();
  const mapped = href.startsWith('/docs/') ? docsHref(href.slice(6).split('#')[0]) + (href.includes('#') ? '#' + href.split('#')[1] : '') : href === '/' ? import.meta.env.BASE_URL : href;
  return <a {...props} href={mapped} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === '_blank' || props.download) return;
    if (href.startsWith('/docs/') || href === '/') { event.preventDefault(); navigate(mapped); }
  }} />;
}

class DocumentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert"><h2>No se pudo cargar esta guía</h2><p>Comprueba la conexión y vuelve a intentarlo.</p><button type="button" onClick={() => window.location.reload()}>Recargar</button></div> : this.props.children;
  }
}

export function DocsPage({ slug }: { slug: string }) {
  const current = canonicalSlug(slug);
  const page = catalog.find(item => item.slug === current);
  const location = useLocation();
  const navigate = useNavigate();
  const loader = documents[`./content/pages/${current}.mdx`];
  const Content = useMemo(() => lazy(async () => {
    if (!loader) return { default: () => <p>La guía no existe. Elige una página de la navegación o utiliza la búsqueda.</p> };
    const module = await loader() as { default: ComponentType<{ components?: unknown }>; toc?: { title: string; url: string; depth: number }[] };
    return { default: () => <FumadocsPage toc={module.toc?.filter(item => item.depth > 1)} tableOfContent={{ style: 'clerk' }}
      >
      <DocsTitle>{page?.title}</DocsTitle>
      <DocsDescription>{page?.description}</DocsDescription>
      <div className="docs-page-meta"><span><FileText size={13} /> Lectura: {Math.max(1, Math.ceil((page?.text.split(' ').length ?? 0) / 220))} min</span><span>Escritorio · v{release.version}</span></div>
      <DocsBody><module.default components={mdxComponents} /></DocsBody>
    </FumadocsPage> };
  }), [loader, current, page]);

  useEffect(() => {
    document.documentElement.classList.add('docs-mode');
    const previousTitle = document.title;
    return () => {
      document.documentElement.classList.remove('docs-mode');
      document.title = previousTitle;
    };
  }, []);
  useEffect(() => {
    document.title = `${page?.title ?? 'Guía no encontrada'} · Sparta Docs`;
    const description = document.querySelector('meta[name="description"]');
    const previous = description?.getAttribute('content');
    if (page) description?.setAttribute('content', page.description);
    if (!location.hash) window.scrollTo(0, 0);
    return () => { if (previous) description?.setAttribute('content', previous); };
  }, [page, location.hash]);

  const framework = useMemo(() => ({
    usePathname: () => docsPath(current),
    useParams: () => ({ slug: current.split('/') }),
    useRouter: () => ({ push: (url: string) => {
      const [path, hash] = url.split('#');
      navigate(path.startsWith('/docs/') ? docsHref(path.slice(6)) + (hash ? `#${hash}` : '') : url);
    }, refresh: () => window.location.reload() }),
    Link: DocsLink,
  }), [current, navigate]);

  return <FrameworkProvider {...framework}>
    <RootProvider theme={{ defaultTheme: 'dark', storageKey: 'sparta-docs-theme' }} search={{ SearchDialog, preload: false }} i18n={{ locale: 'es', translations: {
      'Search(search trigger)': 'Buscar…',
      'Open Search(search trigger)(aria-label)': 'Abrir búsqueda',
      'Collapse Sidebar(sidebar)(aria-label)': 'Contraer navegación',
      'Open Sidebar(sidebar)(aria-label)': 'Abrir navegación',
      'Close Sidebar(sidebar)(aria-label)': 'Cerrar navegación',
      'Close Search(search dialog)(aria-label)': 'Cerrar búsqueda',
      'Search(search dialog)': 'Buscar documentación',
      'Toggle Theme(theme switcher)(aria-label)': 'Cambiar tema',
      'Copy Text(code block)(aria-label)': 'Copiar código',
      'Copied Text(code block)(aria-label)': 'Código copiado',
      'Light(theme switcher)(aria-label)': 'Claro',
      'Dark(theme switcher)(aria-label)': 'Oscuro',
      'System(theme switcher)(aria-label)': 'Sistema',
      'On this page(table of contents)': 'En esta página',
      'Edit on GitHub(edit page)': 'Editar en GitHub',
      'Previous Page(pagination)': 'Anterior',
      'Next Page(pagination)': 'Siguiente',
      'Last updated on(page footer)': 'Actualizado',
      'Copy Anchor Link(heading anchor)(aria-label)': 'Copiar enlace de sección',
    } }}>
      <div className="docs-shell">
        <a className="docs-skip" href="#nd-page">Saltar al contenido</a>
        <DocsLayout tree={tree} nav={{ title: <span className="docs-brand"><span className="docs-brand-mark"><img src={`${import.meta.env.BASE_URL}brand/sparta-white.png`} alt="" /></span><strong>Sparta</strong><span>docs</span></span>, url: '/' }}
          githubUrl="https://github.com/Naiker12/Sparta-Agent"
          sidebar={{ defaultOpenLevel: 0, footer: <div className="docs-sidebar-footer"><DocsLink className="docs-help" href="/">Volver al sitio<ChevronRight size={13} /></DocsLink><a className="docs-help" href="https://github.com/Naiker12/Sparta-Agent/issues" target="_blank" rel="noreferrer">Reportar un problema<ExternalLink size={13} /></a><span className="docs-footer-version">Documentación · v{release.version}</span></div> }}
          links={[]}>
          <DocumentBoundary key={current}><Suspense fallback={<div className="docs-loading" role="status">Cargando guía…</div>}>
            {page ? <Content /> : <FumadocsPage><DocsTitle>Guía no encontrada</DocsTitle><DocsDescription>Esta dirección no corresponde a una página disponible.</DocsDescription><DocsLink href="/docs/index">Volver a la introducción <ChevronRight size={16} /></DocsLink></FumadocsPage>}
          </Suspense></DocumentBoundary>
        </DocsLayout>
      </div>
    </RootProvider>
  </FrameworkProvider>;
}
