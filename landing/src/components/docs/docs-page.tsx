import { Component, lazy, Suspense, useEffect, useMemo, type ComponentType, type ReactNode, type ComponentProps } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FrameworkProvider } from 'fumadocs-core/framework';
import type { Root } from 'fumadocs-core/page-tree';
import { RootProvider } from 'fumadocs-ui/provider/base';
import { DocsBody, DocsDescription, DocsPage as FumadocsPage, DocsTitle } from 'fumadocs-ui/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { BookOpen, ExternalLink, FileText, ChevronRight } from 'lucide-react';
import { catalog } from './lib/catalog.generated';
import { canonicalSlug, docsHref, docsPath, groups } from './lib/navigation';
import './docs.css';
import type { SharedProps } from 'fumadocs-ui/components/dialog/search';

import { DocsVideo } from './docs-video';

const LazySearchDialog = lazy(() => import('./docs-search'));
function SearchDialog(props: SharedProps) {
  return <Suspense fallback={null}><LazySearchDialog {...props} /></Suspense>;
}
const documents = import.meta.glob('./content/pages/**/*.mdx');
const mdxComponents = { ...defaultMdxComponents, DocsVideo };
const tree: Root = {
  name: 'Documentación',
  children: groups.flatMap(group => [
    { type: 'separator' as const, name: group.title },
    ...group.pages.flatMap(slug => {
      const page = catalog.find(item => item.slug === slug);
      return page ? [{ type: 'page' as const, name: page.title, url: docsPath(slug) }] : [];
    }),
  ]),
};

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
      editOnGithub={{ owner: 'Naiker12', repo: 'Sparta-Agent', sha: 'main', path: `landing/src/components/docs/content/pages/${current}.mdx` }}>
      <div className="docs-eyebrow"><span className="docs-status-dot" /> GUÍA DE SPARTA AGENT</div>
      <DocsTitle>{page?.title}</DocsTitle>
      <DocsDescription>{page?.description}</DocsDescription>
      <div className="docs-page-meta"><span><FileText size={13} /> Lectura: {Math.max(1, Math.ceil((page?.text.split(' ').length ?? 0) / 220))} min</span><span>Escritorio · v0.2.20</span></div>
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
      search: 'Buscar documentación', searchNoResult: 'Sin resultados', toc: 'En esta página', tocNoHeadings: 'Sin secciones', lastUpdate: 'Actualizado', nextPage: 'Siguiente', previousPage: 'Anterior', chooseTheme: 'Cambiar tema', editOnGithub: 'Editar en GitHub',
    } }}>
      <div className="docs-shell">
        <a className="docs-skip" href="#nd-page">Saltar al contenido</a>
        <DocsLayout tree={tree} nav={{ title: <span className="docs-brand"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /><strong>Sparta</strong><span>docs</span></span>, url: '/' }}
          githubUrl="https://github.com/Naiker12/Sparta-Agent"
          sidebar={{ defaultOpenLevel: 1, banner: <div className="docs-sidebar-banner"><BookOpen size={16} /><span>Documentación</span><span className="docs-version">0.2</span></div>, footer: <a className="docs-help" href="https://github.com/Naiker12/Sparta-Agent/issues" target="_blank" rel="noreferrer">¿Encontraste un problema?<ExternalLink size={13} /></a> }}
          links={[{ text: 'Ir al sitio', url: '/', active: 'none' }]}>
          <DocumentBoundary key={current}><Suspense fallback={<div className="docs-loading" role="status">Cargando guía…</div>}>
            {page ? <Content /> : <FumadocsPage><DocsTitle>Guía no encontrada</DocsTitle><DocsDescription>Esta dirección no corresponde a una página disponible.</DocsDescription><DocsLink href="/docs/index">Volver a la introducción <ChevronRight size={16} /></DocsLink></FumadocsPage>}
          </Suspense></DocumentBoundary>
        </DocsLayout>
      </div>
    </RootProvider>
  </FrameworkProvider>;
}
