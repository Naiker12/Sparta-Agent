import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  ChevronRight,
  Github,
  KeyRound,
  Laptop,
  Menu,
  Network,
  ShieldCheck,
  TerminalSquare,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { cn, getPublicUrl } from '../../lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { ProvidersSection } from './providers-section';
import { OnThisPage } from './on-this-page';

const navigation = [
  { title: 'Primeros pasos', items: [{ label: 'Instalación', slug: 'instalacion' }, { label: 'Desarrollo local', slug: 'desarrollo-local' }] },
  { title: 'Producto', items: [{ label: 'Arquitectura', slug: 'arquitectura' }, { label: 'Agentes y tareas', slug: 'agentes' }, { label: 'Terminal integrada', slug: 'terminal' }, { label: 'Proveedores', slug: 'proveedores' }] },
  { title: 'Extensibilidad', items: [{ label: 'Servidores MCP', slug: 'mcp' }, { label: 'Skills', slug: 'skills' }] },
  { title: 'Seguridad', items: [{ label: 'Permisos y límites', slug: 'permisos' }, { label: 'Vault de credenciales', slug: 'vault' }] },
];

const steps = [
  { icon: Laptop, title: '1. Prepara el entorno', body: 'Node.js 18+ y pnpm 10+ son los requisitos del monorepo.' },
  { icon: TerminalSquare, title: '2. Instala dependencias', body: 'La instalación une los paquetes del escritorio y sus módulos compartidos.' },
  { icon: Workflow, title: '3. Abre Sparta Agent', body: 'El comando de desarrollo inicia la aplicación basada en Electron y Vite.' },
];

function CodeBlock() {
  const [copied, setCopied] = useState(false);
  const command = 'git clone https://github.com/Naiker12/Sparta-Agent.git\ncd Sparta-Agent\npnpm install\npnpm dev';

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 shadow-sm dark:border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-zinc-400">
        <div className="flex items-center gap-2"><TerminalSquare className="size-3.5" /> terminal</div>
        <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-zinc-300 transition hover:bg-white/10 hover:text-white">
          {copied ? <Check className="size-3.5 text-emerald-400" /> : null}{copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-7 text-zinc-100"><code><span className="text-zinc-500">$ </span>git clone https://github.com/Naiker12/Sparta-Agent.git{'\n'}<span className="text-zinc-500">$ </span>cd Sparta-Agent{'\n'}<span className="text-zinc-500">$ </span>pnpm install{'\n'}<span className="text-zinc-500">$ </span>pnpm dev</code></pre>
    </div>
  );
}

export function DocsPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const docsQuery = new URLSearchParams(window.location.search).get('docs');
  const currentPage = docsQuery || window.location.pathname.split('/docs')[1]?.replace(/^\//, '').replace(/\/$/, '') || 'inicio';
  const favicon = getPublicUrl('favicon.svg');
  const screenshot = getPublicUrl('escritorio.png');
  const docsHref = (slug = '') => `${getPublicUrl('')}?docs${slug ? `=${slug}` : ''}`;

  return (
    <div className="min-h-screen bg-white text-zinc-950 dark:bg-[#09090b] dark:text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#09090b]/90">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6">
          <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href={getPublicUrl('')} className="flex items-center gap-2.5 font-semibold tracking-tight"><img src={favicon} alt="Sparta Agent" className="size-7" /><span>Sparta Agent</span></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Docs</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
          <div className="hidden items-center gap-5 text-sm text-zinc-600 md:flex dark:text-zinc-400">
            <a href={docsHref('instalacion')} className="hover:text-zinc-950 dark:hover:text-white">Guía</a>
            <a href={docsHref('arquitectura')} className="hover:text-zinc-950 dark:hover:text-white">Arquitectura</a>
            <a href={docsHref('permisos')} className="hover:text-zinc-950 dark:hover:text-white">Seguridad</a>
            <a href="https://github.com/Naiker12/Sparta-Agent" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-950 transition hover:bg-zinc-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10"><Github className="size-4" /> GitHub</a>
          </div>
          <button aria-label="Abrir navegación" onClick={() => setMenuOpen(!menuOpen)} className="rounded-md p-2 md:hidden"><Menu className="size-5" /></button>
        </div>
        {menuOpen ? <nav className="border-t border-zinc-200 px-5 py-4 text-sm md:hidden dark:border-white/10"><div className="flex flex-col gap-3"><a href={docsHref('instalacion')}>Guía</a><a href={docsHref('arquitectura')}>Arquitectura</a><a href={docsHref('permisos')}>Seguridad</a><a href="https://github.com/Naiker12/Sparta-Agent" target="_blank" rel="noreferrer">GitHub</a></div></nav> : null}
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[238px_minmax(0,1fr)] xl:grid-cols-[238px_minmax(0,1fr)_200px]">
        <aside aria-label="Navegación de documentación" className="hidden h-[calc(100vh-4rem)] overflow-y-auto border-r border-zinc-200 px-5 py-8 lg:sticky lg:top-16 lg:block dark:border-white/10">
          <div><p className="mb-5 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Documentación</p><div className="flex flex-col gap-6">{navigation.map((group) => <div key={group.title}><p className="mb-2 px-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">{group.title}</p><div className="flex flex-col gap-0.5">{group.items.map((item) => { const isActive = currentPage === item.slug; return <a key={item.label} href={docsHref(item.slug)} aria-current={isActive ? 'page' : undefined} className={cn('rounded-md border-l-2 px-2 py-1.5 text-sm transition', isActive ? 'border-zinc-950 bg-zinc-100 font-medium text-zinc-950 dark:border-white dark:bg-white/10 dark:text-white' : 'border-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white')}>{item.label}</a>; })}</div></div>)}</div><Separator className="my-6" /><a href="https://github.com/Naiker12/Sparta-Agent" target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/5 dark:hover:text-white"><Github className="size-4" /> Código fuente</a></div>
        </aside>

        <main id="contenido" className="min-w-0 px-5 py-12 sm:px-10 lg:px-16 lg:py-16">
          <motion.div key={currentPage} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}>
          {currentPage === 'inicio' ? <section className="max-w-4xl">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
              <p className="mb-5 text-sm font-medium text-zinc-500">Documentación de producto</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">Construye con un agente que entiende tu espacio de trabajo.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">Sparta Agent reúne chat, tareas, terminal, memoria y conectores MCP en una aplicación de escritorio local-first. Esta guía explica las piezas que ya viven en el repositorio.</p>
            </motion.div>
            <Alert className="mt-8 border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[.03]"><BookOpen className="size-4" /><AlertTitle>Documentación basada en el código actual</AlertTitle><AlertDescription>Las guías describen módulos y flujos presentes en el monorepo. Cuando una capacidad depende de un proveedor, se indica como integración configurable, no como promesa de producto.</AlertDescription></Alert>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .12 }} className="mt-10 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-2 shadow-sm dark:border-white/10 dark:bg-white/[.03]">
              <img src={screenshot} alt="Interfaz de escritorio de Sparta Agent" className="aspect-[16/8.4] w-full rounded-xl object-cover object-top" />
            </motion.div>
          </section> : null}

          {(currentPage === 'instalacion' || currentPage === 'desarrollo-local') ? <section id="primeros-pasos" className="max-w-4xl">
            <p className="text-sm font-medium text-zinc-500">Primeros pasos</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Ejecuta Sparta Agent localmente</h2><p className="mt-4 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">El repositorio usa pnpm y centraliza los paquetes de la aplicación de escritorio dentro de <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-white/10">desktop/</code>. Después de instalar, Vite inicia el flujo de desarrollo definido por el proyecto.</p>
            <div className="mt-7"><CodeBlock /></div>
            <div className="mt-8 grid gap-3 md:grid-cols-3">{steps.map(({ icon: Icon, title, body }) => <div key={title} className="rounded-xl border border-zinc-200 p-5 dark:border-white/10"><Icon className="mb-7 size-5 text-zinc-500" strokeWidth={1.6} /><h3 className="font-medium">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{body}</p></div>)}</div>
          </section> : null}

          {currentPage === 'arquitectura' ? <section id="arquitectura" className="max-w-4xl">
            <p className="text-sm font-medium text-zinc-500">Arquitectura</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Capas claras, responsabilidades separadas</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">{[
              [Boxes, 'Aplicación de escritorio', 'ia-sparta-app-shell organiza el ciclo de vida de Electron y registra los canales necesarios.'],
              [Workflow, 'Flujo agéntico', 'Los módulos de chat, tareas y eventos muestran planes, actividad y resultados durante la ejecución.'],
              [Network, 'MCP y extensiones', 'La capa MCP administra catálogo, conexión, OAuth, herramientas y estados de los servidores.'],
              [TerminalSquare, 'Herramientas nativas', 'Archivos y terminal se conectan mediante un puente IPC para trabajar desde la aplicación de escritorio.'],
            ].map(([Icon, title, body]) => <article key={title as string} className="group rounded-xl border border-zinc-200 p-5 transition hover:border-zinc-400 dark:border-white/10 dark:hover:border-white/30"><Icon className="size-5 text-zinc-500" strokeWidth={1.6} /><h3 className="mt-8 font-medium">{title as string}</h3><p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{body as string}</p><a href="https://github.com/Naiker12/Sparta-Agent" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white">Ver código <ChevronRight className="size-4" /></a></article>)}</div>
          </section> : null}

          {currentPage === 'agentes' ? <section id="agentes" className="max-w-4xl">
            <p className="text-sm font-medium text-zinc-500">Producto</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Agentes, planes y actividad</h2><p className="mt-4 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">El paquete <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-white/10">ia-sparta-agents</code> separa el ciclo de tareas de la interfaz. La aplicación muestra el plan, los subagentes, las herramientas y los cambios para que puedas seguir una ejecución antes de aceptar su resultado.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">{[['Plan', 'Define pasos y estado de la tarea.'], ['Actividad', 'Expone eventos durante la ejecución.'], ['Revisión', 'Presenta diffs antes de consolidar cambios.']].map(([title, body]) => <div key={title} className="rounded-xl border border-zinc-200 p-5 dark:border-white/10"><p className="font-medium">{title}</p><p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{body}</p></div>)}</div>
          </section> : null}

          {currentPage === 'terminal' ? <section id="terminal" className="max-w-4xl">
            <p className="text-sm font-medium text-zinc-500">Producto</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Terminal nativa con permisos explícitos</h2><p className="mt-4 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">La terminal de <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-white/10">ia-sparta-terminal</code> se ejecuta a través del proceso principal de Electron. El agente no necesita un shell web: las solicitudes pasan por el bridge IPC y respetan las decisiones de permiso.</p>
          </section> : null}

          {currentPage === 'mcp' ? <section id="servidores-mcp" className="max-w-4xl">
            <p className="text-sm font-medium text-zinc-500">Extensibilidad</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Conecta herramientas con MCP</h2><p className="mt-4 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">El módulo <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-white/10">ia-sparta-mcp</code> incluye el catálogo, el alta de servidores, pruebas de conexión, OAuth y una vista para inspeccionar sus herramientas. Las acciones del agente quedan separadas de los transportes y de la interfaz.</p>
            <Accordion className="mt-7 rounded-xl border border-zinc-200 px-5 dark:border-white/10" defaultValue={['catalogo']}>
              <AccordionItem value="catalogo"><AccordionTrigger>Catálogo y configuración</AccordionTrigger><AccordionContent>Agrega una configuración de servidor desde la interfaz y valida su disponibilidad antes de delegar herramientas al agente.</AccordionContent></AccordionItem>
              <AccordionItem value="ejecucion"><AccordionTrigger>Ejecución visible</AccordionTrigger><AccordionContent>Las llamadas MCP se representan en los eventos de la sesión, por lo que el usuario puede seguir el trabajo y sus resultados.</AccordionContent></AccordionItem>
              <AccordionItem value="oauth"><AccordionTrigger>Conectores OAuth</AccordionTrigger><AccordionContent>Los conectores que requieren autorización se manejan desde el diálogo OAuth del módulo MCP, sin incorporar tokens en los prompts.</AccordionContent></AccordionItem>
            </Accordion>
          </section> : null}

          {currentPage === 'proveedores' ? <ProvidersSection /> : null}

          {currentPage === 'skills' ? <section id="skills" className="max-w-4xl">
            <p className="text-sm font-medium text-zinc-500">Extensibilidad</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Skills para especializar el agente</h2><p className="mt-4 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">El repositorio mantiene un catálogo de skills y un canal IPC específico para cargarlas. Así, las instrucciones especializadas se mantienen como capacidades auditables del proyecto, en lugar de quedar escondidas en una conversación.</p>
          </section> : null}

          {currentPage === 'permisos' ? <section id="seguridad" className="max-w-4xl">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-7 sm:p-9 dark:border-white/10 dark:bg-white/[.03]"><div className="flex items-start gap-4"><div className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-white/10 dark:bg-zinc-950"><ShieldCheck className="size-5" /></div><div><p className="text-sm font-medium text-zinc-500">Seguridad por diseño</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">La ejecución sensible no queda oculta.</h2><p className="mt-3 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">El puente IPC incorpora validación de rutas y detección de comandos destructivos. Las acciones que requieren decisión se integran con el sistema de permisos de la ventana.</p></div></div><div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white p-5 dark:bg-zinc-950"><KeyRound className="size-5 text-zinc-500" /><h3 className="mt-5 font-medium">Credenciales aisladas</h3><p className="mt-2 text-sm leading-6 text-zinc-500">El paquete Vault y el administrador de claves separan el manejo de proveedores del resto de la interfaz.</p></div><div className="rounded-xl bg-white p-5 dark:bg-zinc-950"><BookOpen className="size-5 text-zinc-500" /><h3 className="mt-5 font-medium">Decisiones visibles</h3><p className="mt-2 text-sm leading-6 text-zinc-500">Las operaciones se comunican mediante contratos y canales explícitos, para que el flujo sea inspeccionable.</p></div></div></div>
          </section> : null}

          {currentPage === 'vault' ? <section id="vault" className="max-w-4xl">
            <p className="text-sm font-medium text-zinc-500">Seguridad</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Vault y gestión de claves</h2><p className="mt-4 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">Las integraciones de proveedores se apoyan en <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-white/10">ia-sparta-vault</code> y su administrador de claves. El bridge IPC evita que este detalle de almacenamiento se filtre hacia los componentes de chat.</p>
          </section> : null}

          {currentPage !== 'inicio' ? <section className="mt-20 max-w-4xl border-t border-zinc-200 py-12 dark:border-white/10"><h2 className="text-2xl font-semibold tracking-tight">¿Listo para explorar el proyecto?</h2><p className="mt-3 text-zinc-600 dark:text-zinc-400">Consulta el código, ejecuta el entorno local y adapta los conectores a tu flujo.</p><a href="https://github.com/Naiker12/Sparta-Agent" target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"><Github className="size-4" /> Abrir repositorio <ArrowRight className="size-4" /></a></section> : null}
          </motion.div>
        </main>
        <OnThisPage page={currentPage} />
      </div>
    </div>
  );
}
