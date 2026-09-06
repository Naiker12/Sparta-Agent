import { lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const LandingPage = lazy(() => import('./landing-page'));
const DocsPage = lazy(() => import('./components/docs/docs-page').then(module => ({ default: module.DocsPage })));

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const pathSlug = location.pathname.match(/\/docs\/?(.*)$/)?.[1];
  const docs = query.has('docs') || pathSlug !== undefined || location.hash === '#docs';
  return <Suspense fallback={<main className="min-h-screen grid place-items-center" role="status">Cargando Sparta…</main>}>
    {docs ? <DocsPage slug={query.get('docs') || pathSlug || 'index'} /> : <LandingPage onOpenDocs={() => navigate(`${import.meta.env.BASE_URL}?docs=index`)} />}
  </Suspense>;
}
