import { lazy, Suspense, useEffect, useState, type MouseEvent } from "react";
import {
  Apple,
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Download,
  FolderOpen,
  Github,
  Menu,
  Monitor,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { detectPlatform, platforms, release, repository } from "@/lib/releases";
import { getPublicUrl } from "@/lib/utils";
import "./styles/landing-refinement.css";
import "./styles/desktop-demo-theme.css";
import { SpartaMark } from "@/components/landing/sparta-mark";
import {
  Blocks,
  Bot,
  Clock3,
  LifeBuoy,
  MessageSquare,
  Sparkles,
  GitBranch,
  Shield,
  FileText,
  Star,
} from "lucide-react";

const SpartaPreview = lazy(() => import("./components/landing/sparta-preview"));
const faqs = [
  [
    "¿Cómo empiezo?",
    "Descarga Sparta Agent, prepara las herramientas en el primer arranque y conecta un proveedor de IA por API. Después elige una carpeta y empieza una conversación.",
  ],
  [
    "¿Necesito una suscripción o una API?",
    "Necesitas una conexión por API con un proveedor compatible. El uso y el coste del modelo dependen de tu proveedor; una suscripción a su aplicación de chat no implica acceso a su API.",
  ],
  [
    "¿Dónde están mis archivos y conversaciones?",
    "El espacio de trabajo y el historial se mantienen en tu equipo. El contenido que incluyas en una solicitud —mensajes, adjuntos o resultados de herramientas— se envía al proveedor de IA que elijas.",
  ],
  [
    "¿Quién decide qué puede cambiar el agente?",
    "Tú eliges el acceso a la carpeta y el modo de aprobación de herramientas. Puedes trabajar en solo lectura, permitir edición o revisar las acciones según la configuración de tu tarea.",
  ],
  [
    "¿La demo ejecuta acciones reales?",
    `La demo usa datos de ejemplo para explorar la interfaz de Sparta ${release.version}. No accede a tus archivos, no ejecuta herramientas reales y no necesita una API. Para trabajar con tu proyecto, descarga la aplicación de escritorio y conecta tu proveedor.`,
  ],
];

export default function LandingPage({
  onOpenDocs,
}: {
  onOpenDocs: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [platform, setPlatform] =
    useState<ReturnType<typeof detectPlatform>>(null);
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);
  const docsUrl = getPublicUrl("?docs=index");
  const openDocs = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      onOpenDocs();
    }
  };
  return (
    <div className="landing-shell">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="site-header site-container">
        <a
          className="site-brand"
          href={getPublicUrl("")}
          aria-label="Sparta Agent, inicio"
        >
          <SpartaMark />
          Sparta Agent
        </a>
        <nav className="desktop-nav" aria-label="Navegación principal">
          <a href="#producto">
            <Bot />
            Producto
          </a>
          <a href={docsUrl} onClick={openDocs}>
            <BookOpen />
            Documentación
          </a>
          <a href={repository} target="_blank" rel="noopener noreferrer">
            <Github />
            GitHub <ArrowUpRight />
          </a>
        </nav>
        <div className="header-actions">
          <a href="#descargas" className={buttonVariants({ size: "sm" })}>
            <Download />
            Descargar
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu-toggle"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            className="mobile-navigation"
            aria-label="Navegación móvil"
          >
            <a href="#producto" onClick={() => setMenuOpen(false)}>
              Producto
            </a>
            <a href={docsUrl} onClick={openDocs}>
              Documentación
            </a>
            <a href={repository}>GitHub</a>
          </nav>
        )}
      </header>
      <main id="contenido">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-copy site-container">
            <div className="platform-pill">
              <span>DESKTOP</span>Windows <i /> macOS <i /> Linux
            </div>
            <h1 id="hero-title">
              Conoce <SpartaMark className="hero-mark" /> Sparta.
            </h1>
            <p>
              Tu proyecto. Tu IA. Un solo espacio.
              <br />
              <span>
                Conecta tu proveedor y trabaja con archivos, herramientas y
                conversaciones desde tu escritorio.
              </span>
            </p>
            <div className="provider-strip" aria-label="Proveedores por API">
              {[
                ["openai", "OpenAI"],
                ["anthropic", "Anthropic"],
                ["gemini", "Gemini"],
                ["deepseek", "DeepSeek"],
              ].map(([id, name]) => (
                <a
                  key={id}
                  href={getPublicUrl(
                    "?docs=core-concepts/models-and-providers",
                  )}
                >
                  <img src={getPublicUrl(`brand/${id}.svg`)} alt="" />
                  {name}
                </a>
              ))}
              <span>y más, por API</span>
            </div>
            <div className="hero-actions">
              <div className="download-split">
                <a
                  className={buttonVariants({ size: "lg" })}
                  href={platform?.url || "#descargas"}
                >
                  <Download />
                  {platform
                    ? `Descargar para ${platform.name}`
                    : "Descargar Sparta"}
                </a>
                <details className="platform-choice">
                  <summary aria-label="Elegir otro sistema operativo">
                    <ChevronDown />
                  </summary>
                  <div>
                    {platforms.map((item) => (
                      <a key={item.id} href={item.url}>
                        <PlatformIcon id={item.id} />
                        {item.name}
                        <ArrowDown />
                      </a>
                    ))}
                  </div>
                </details>
              </div>
              <a
                className={buttonVariants({ variant: "outline", size: "lg" })}
                href={docsUrl}
                onClick={openDocs}
              >
                <BookOpen />
                Documentación
              </a>
            </div>
            <p className="hero-release">
              Código abierto · v{release.version} disponible
            </p>
          </div>
          <div id="producto" className="site-container demo-section">
            <Suspense
              fallback={
                <div className="preview-placeholder" role="status">
                  Preparando la demo de Sparta…
                </div>
              }
            >
              <SpartaPreview />
            </Suspense>
          </div>
        </section>
        <section
          className="benefits-section site-container"
          aria-labelledby="benefits-title"
        >
          <div className="section-heading">
            <span className="eyebrow">
              MENOS CAMBIAR DE VENTANA. MÁS HACER.
            </span>
            <h2 id="benefits-title">Todo parte de tu proyecto.</h2>
          </div>
          <div className="benefits-grid">
            <article>
              <FolderOpen />
              <h3>Tu contexto, a mano.</h3>
              <p>
                Conecta una carpeta, adjunta documentos y mantén los archivos
                junto a la conversación.
              </p>
            </article>
            <article>
              <MessageIcon />
              <h3>La IA que tú eliges.</h3>
              <p>
                Conecta tu proveedor por API y elige el modelo que mejor se
                adapte a cada tarea.
              </p>
            </article>
            <article>
              <ShieldCheck />
              <h3>Tú marcas los límites.</h3>
              <p>
                Elige el acceso a tus carpetas y cómo quieres aprobar las
                acciones de las herramientas.
              </p>
            </article>
          </div>
          <div className="integration-note">
            <Check />
            Amplía tu espacio con herramientas MCP y skills.
            <a href={getPublicUrl("?docs=mcp/introduction")}>
              Conoce las conexiones <ArrowUpRight />
            </a>
          </div>
        </section>
        <section
          id="descargas"
          className="downloads-section site-container"
          aria-labelledby="downloads-title"
        >
          <div className="section-heading">
            <span className="eyebrow">TU PRÓXIMO ESPACIO DE TRABAJO</span>
            <h2 id="downloads-title">Lleva Sparta a tu escritorio.</h2>
            <p>
              Elige tu sistema. Conecta tu proveedor. Empieza con una
              conversación.
            </p>
          </div>
          <div className="download-grid">
            {platforms.map((item) => (
              <a
                className="download-card"
                key={item.id}
                href={item.url}
                style={{ backgroundColor: item.color }}
              >
                <div>
                  <PlatformIcon id={item.id} />
                  <span>v{release.version}</span>
                </div>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.label}</p>
                  <strong>
                    Descargar {item.extension}
                    <ArrowUpRight />
                  </strong>
                </div>
              </a>
            ))}
          </div>
          <p className="download-note">
            El consumo de IA se factura según tu proveedor.{" "}
            <a href={release.url} target="_blank" rel="noopener noreferrer">
              Ver cambios de esta versión <ArrowUpRight />
            </a>
          </p>
        </section>
        <section
          id="preguntas"
          className="faq-section site-container"
          aria-labelledby="faq-title"
        >
          <div className="section-heading">
            <span className="eyebrow">ANTES DE EMPEZAR</span>
            <h2 id="faq-title">Unas respuestas rápidas.</h2>
          </div>
          <Accordion>
            {faqs.map(([question, answer], index) => (
              <AccordionItem key={question} value={index}>
                <AccordionTrigger>{question}</AccordionTrigger>
                <AccordionContent>
                  <p>{answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>
      <footer className="site-footer site-container">
        <div className="footer-invitation">
          <SpartaMark tone="black" />
          <div>
            <span className="eyebrow">TU ESPACIO. TUS HERRAMIENTAS.</span>
            <h2>Haz sitio para tu próxima idea.</h2>
            <p>Conecta tu proveedor y empieza con tu proyecto.</p>
          </div>
          <a className="footer-download" href="#descargas">
            <Download />
            Descargar Sparta
            <ArrowUpRight />
          </a>
        </div>
        <div className="footer-main">
          <div className="footer-brand-block">
            <a className="site-brand" href={getPublicUrl("")}>
              <SpartaMark />
              Sparta Agent
            </a>
            <p>
              Conversaciones, proyectos y herramientas.
              <br />
              Todo en tu escritorio, bajo tu control.
            </p>
            <div className="footer-social">
              <a href={repository} aria-label="Sparta en GitHub">
                <Github />
              </a>
              <a href={release.url} aria-label="Última versión">
                <GitBranch />
              </a>
              <a href={repository + "/issues"} aria-label="Ayuda y comentarios">
                <MessageSquare />
              </a>
            </div>
            <span className="footer-license">
              <Shield />
              Código abierto · Licencia MIT
            </span>
          </div>
          <nav className="footer-columns" aria-label="Recursos de Sparta">
            <div>
              <h3>Producto</h3>
              <a href="#producto">
                <Bot />
                Demo interactiva
              </a>
              <a href="#descargas">
                <Download />
                Descargas
              </a>
              <a href={release.url}>
                <GitBranch />
                Novedades de v{release.version}
              </a>
              <a
                href={getPublicUrl("?docs=core-concepts/security-and-sandbox")}
              >
                <Shield />
                Permisos y seguridad
              </a>
            </div>
            <div>
              <h3>Aprende</h3>
              <a href={docsUrl} onClick={openDocs}>
                <BookOpen />
                Documentación
              </a>
              <a href={getPublicUrl("?docs=quickstart")}>
                <Sparkles />
                Primeros pasos
              </a>
              <a href={getPublicUrl("?docs=mcp/introduction")}>
                <Blocks />
                Herramientas MCP
              </a>
              <a href={getPublicUrl("?docs=skills/overview")}>
                <FileText />
                Skills y reglas
              </a>
            </div>
            <div>
              <h3>Comunidad</h3>
              <a href={repository}>
                <Github />
                Código fuente
              </a>
              <a href={repository + "/issues"}>
                <LifeBuoy />
                Ayuda y comentarios
              </a>
              <a href={repository + "/blob/main/LICENSE"}>
                <FileText />
                Licencia MIT
              </a>
              <a href={getPublicUrl("?docs=architecture/frontend-ui")}>
                <GitBranch />
                Arquitectura
              </a>
            </div>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Sparta Agent</span>
          <div className="footer-platforms">
            <PlatformIcon id="windows" />
            Windows<span>·</span>
            <PlatformIcon id="mac" />
            macOS<span>·</span>
            <PlatformIcon id="linux" />
            Linux
          </div>
          <a href="#contenido">
            Volver arriba <ArrowUpRight />
          </a>
        </div>
      </footer>
    </div>
  );
}
function PlatformIcon({ id }: { id: string }) {
  return id.startsWith("mac") ? (
    <Apple />
  ) : id === "windows" ? (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2 2h9v9H2zM13 2h9v9h-9zM2 13h9v9H2zM13 13h9v9h-9z" />
    </svg>
  ) : (
    <Terminal />
  );
}
function MessageIcon() {
  return <Bot />;
}
