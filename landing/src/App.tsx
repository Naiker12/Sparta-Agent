import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  ArrowRight,
  Download,
  Terminal,
  Cpu,
  Layers,
  CheckCircle2,
  Lock,
  Menu,
  X,
  ExternalLink,
  Code2,
  Database,
  Search,
  Bot,
  Monitor,
  Apple,
  FolderOpen,
  GitBranch,
  Wrench,
  BookOpen,
  Shield,
  Sparkles,
} from 'lucide-react'
import { DocsPage } from './components/docs/docs-page'
import { ProductTour } from './components/sections/product-tour'
import { McpGraphShowcase } from './components/sections/mcp-graph-showcase'
import { ReleaseModal } from './components/ui/release-modal'
import { InteractiveSpiderWeb } from './components/canvas/interactive-spider-web'
import { BurstLink, BurstButton } from './components/ui/burst-button'
import { getPublicUrl } from './lib/utils'

// ── SVGL Ecosystem Logos for Marquee ─────────────────────────────────────────
function SvgReact() {
  return (
    <div className="flex items-center gap-2 text-[#9c9c9d] hover:text-white transition-colors">
      <svg className="w-4 h-4" viewBox="-11.5 -10.23174 23 20.46348" fill="#61DAFB">
        <circle cx="0" cy="0" r="2.05" />
        <g stroke="#61DAFB" strokeWidth="1" fill="none">
          <ellipse rx="11" ry="4.2" />
          <ellipse rx="11" ry="4.2" transform="rotate(60)" />
          <ellipse rx="11" ry="4.2" transform="rotate(120)" />
        </g>
      </svg>
      <span className="font-mono text-[11px] font-medium tracking-wider">REACT</span>
    </div>
  )
}

function SvgTypeScript() {
  return (
    <div className="flex items-center gap-2 text-[#9c9c9d] hover:text-white transition-colors">
      <svg className="w-4 h-4" viewBox="0 0 128 128" fill="none">
        <rect width="128" height="128" rx="16" fill="#3178C6" />
        <path d="M72 80v24h12V80h16V68H56v12h16zm-36-4h12c0-8.8 4-13 11-13s11 4.2 11 10.5c0 6.5-4.5 9.5-12 14.5C44 96 36 102 36 114c0 14 11 22 25 22 15 0 25-9 25-23H74c0 7.5-4 12-13 12s-13-4.5-13-11c0-7 5-10 13-15.5 14-8.5 21-14.5 21-25.5 0-14-10-21-23-21-14 0-23 8-23 23z" fill="#FFF" />
      </svg>
      <span className="font-mono text-[11px] font-medium tracking-wider">TYPESCRIPT</span>
    </div>
  )
}

function SvgPython() {
  return (
    <div className="flex items-center gap-2 text-[#9c9c9d] hover:text-white transition-colors">
      <svg className="w-4 h-4" viewBox="0 0 128 128">
        <path fill="#3776AB" d="M63.8 0c-16.8 0-31.5 1.5-31.5 15.3v11.5h31.5v3.8H18.7C8 30.6 0 38.6 0 53.5s7.4 22.9 18.7 22.9h10.9V64.8c0-12.7 11.2-22.9 22.9-22.9h31.5c10.8 0 19.1-8.5 19.1-19.1V15.3C103.1 1.5 80.6 0 63.8 0zm-8.8 9.3c3.2 0 5.7 2.6 5.7 5.7s-2.6 5.7-5.7 5.7-5.7-2.6-5.7-5.7 2.6-5.7 5.7-5.7z" />
        <path fill="#FFD43B" d="M64.2 128c16.8 0 31.5-1.5 31.5-15.3v-11.5H64.2v-3.8h45.1c10.7 0 18.7-8 18.7-22.9s-7.4-22.9-18.7-22.9H98.4v11.6c0 12.7-11.2 22.9-22.9 22.9H44c-10.8 0-19.1 8.5-19.1 19.1v11.6c0 13.8 22.5 15.3 39.3 15.3zm8.8-9.3c-3.2 0-5.7-2.6-5.7-5.7s2.6-5.7 5.7-5.7 5.7 2.6 5.7 5.7-2.6 5.7-5.7 5.7z" />
      </svg>
      <span className="font-mono text-[11px] font-medium tracking-wider">LANGGRAPH // PYTHON</span>
    </div>
  )
}

function SvgRust() {
  return (
    <div className="flex items-center gap-2 text-[#9c9c9d] hover:text-white transition-colors">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#DEA584">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M8 8h8M8 12h8M8 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="font-mono text-[11px] font-medium tracking-wider">RUST CORE</span>
    </div>
  )
}

function SvgElectron() {
  return (
    <div className="flex items-center gap-2 text-[#9c9c9d] hover:text-white transition-colors">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#9FEAF9" strokeWidth="1.5">
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(90 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(150 12 12)" />
        <circle cx="12" cy="12" r="1.5" fill="#9FEAF9" />
      </svg>
      <span className="font-mono text-[11px] font-medium tracking-wider">ELECTRON // MONACO</span>
    </div>
  )
}

function SvgPostgres() {
  return (
    <div className="flex items-center gap-2 text-[#9c9c9d] hover:text-white transition-colors">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#4169E1">
        <ellipse cx="12" cy="6" rx="9" ry="3" />
        <path d="M3 6v6c0 1.66 4.03 3 9 3s9-1.34 9-3V6" fill="none" stroke="#4169E1" strokeWidth="2" />
        <path d="M3 12v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" fill="none" stroke="#4169E1" strokeWidth="2" />
      </svg>
      <span className="font-mono text-[11px] font-medium tracking-wider">POSTGRESQL MCP</span>
    </div>
  )
}

// ── FadeInUp Scroll Reveal ───────────────────────────────────────────────────
export function FadeInUp({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const [isVisible, setIsVisible] = useState(false)
  const domRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (domRef.current) observer.unobserve(domRef.current)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
    )
    if (domRef.current) observer.observe(domRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={domRef}
      style={{
        transitionDuration: '700ms',
        transitionDelay: `${delay}ms`,
      }}
      className={`transition-all ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  )
}

// ── 1. Glass Floating Navigation Bar (Raycast Design) ────────────────────────
function Navbar({ onOpenDocs }: { onOpenDocs: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeLink, setActiveLink] = useState('#producto')

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'Capacidades', href: '#producto' },
    { name: 'Flujo Agéntico', href: '#flujo-agentico' },
    { name: 'Conectores MCP', href: '#mcp' },
    { name: 'Seguridad', href: '#seguridad' },
    { name: 'Skills', href: '#skills' },
    { name: 'FAQ', href: '#faq' },
  ]

  const scrollTo = (href: string) => {
    setMobileOpen(false)
    setActiveLink(href)
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-4 md:py-5 pointer-events-none">
      <nav
        className={`pointer-events-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl border border-[#363739] px-4 py-2.5 transition-all duration-300 sm:gap-5 xl:rounded-full ${
          scrolled
            ? 'bg-[#040506]/95 backdrop-blur-2xl shadow-key'
            : 'bg-[#07080a]/90 backdrop-blur-xl'
        }`}
      >
        {/* Brand: Sparta Official Icon + Wordmark */}
        <a
          href="#about"
          onClick={(e) => {
            e.preventDefault()
            scrollTo('#about')
          }}
          className="flex shrink-0 items-center gap-2.5 pl-1 group select-none"
        >
          <img
            src={getPublicUrl('favicon.svg')}
            alt="Sparta Agent Logo"
            className="size-7 object-contain drop-shadow-[0_0_10px_rgba(234,179,8,0.4)] group-hover:scale-105 transition-transform duration-200"
          />
          <span className="font-medium text-sm tracking-tight text-white flex items-center gap-2">
            Sparta Agent
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-[6px] bg-[#1b1c1e] text-[#9c9c9d] border border-[#363739]">
              v0.2.9
            </span>
          </span>
        </a>

        {/* Desktop Links (Ash text with pure white hover) */}
        <div className="hidden xl:flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-[#9c9c9d]">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => {
                e.preventDefault()
                scrollTo(link.href)
              }}
              className={`px-3 py-1.5 rounded-full transition-all hover:text-white hover:bg-white/[0.06] ${
                activeLink === link.href ? 'text-white bg-white/[0.08]' : ''
              }`}
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* Desktop Action Buttons: Mist Neutral Fill with Burst Shimmer */}
        <div className="flex shrink-0 items-center gap-2.5">
          <BurstLink
            href="https://github.com/Naiker12/Sparta-Agent"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#363739] bg-transparent text-xs font-medium text-[#9c9c9d] transition-colors hover:border-white/30 hover:text-white"
          >
            <span>GitHub</span>
            <ExternalLink className="size-3.5" />
          </BurstLink>

          <BurstButton
            onClick={onOpenDocs}
            className="hidden md:inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#363739] bg-transparent text-xs font-medium text-[#9c9c9d] transition-colors hover:border-white/30 hover:text-white cursor-pointer"
          >
            <BookOpen className="size-3.5" />
            <span>Docs</span>
          </BurstButton>

          <BurstLink
            href="#descargas"
            onClick={(e) => {
              e.preventDefault()
              scrollTo('#descargas')
            }}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-[#e6e6e6] text-xs font-medium text-[#111214] shadow-button-neutral transition-all hover:bg-white active:scale-[0.98]"
          >
            <Download className="size-3.5 text-[#111214]" />
            <span>Descargar</span>
          </BurstLink>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="xl:hidden p-1.5 text-[#9c9c9d] hover:text-white focus:outline-none"
            aria-label="Abrir menú"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-auto absolute top-20 left-4 right-4 rounded-2xl border border-[#363739] bg-[#07080a]/95 p-6 shadow-key backdrop-blur-2xl xl:hidden space-y-4"
          >
            <div className="space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollTo(link.href)
                  }}
                  className="block text-sm font-medium text-[#9c9c9d] hover:text-white py-1"
                >
                  {link.name}
                </a>
              ))}
            </div>

            <div className="pt-4 border-t border-[#363739] flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileOpen(false)
                  onOpenDocs()
                }}
                className="w-full text-center border border-[#363739] text-white text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"
              >
                <BookOpen className="size-3.5" />
                <span>Documentación (Docs)</span>
              </button>
              <a
                href="#descargas"
                onClick={(e) => {
                  e.preventDefault()
                  scrollTo('#descargas')
                }}
                className="w-full text-center bg-[#e6e6e6] text-[#454647] text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-button-neutral"
              >
                <Download className="size-3.5" />
                <span>Descargar Sparta Agent</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ── 2. Hero Section (Raycast Style — 56px Inter 400 & Atmospheric Wash) ───────
function HeroSection() {
  const techLogos = [SvgReact, SvgTypeScript, SvgPython, SvgRust, SvgElectron, SvgPostgres]
  const marqueeLogos = [...techLogos, ...techLogos, ...techLogos, ...techLogos]

  return (
    <section
      id="about"
      className="relative z-0 flex min-h-screen flex-col items-center justify-center overflow-hidden bg-transparent pb-16 pt-36"
    >
      {/* Raycast Atmospheric Blue/Coral Wash */}
      <div className="pointer-events-none absolute inset-0 -z-10 hero-atmosphere" />
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] hero-coral-glow blur-3xl -z-10" />

      <div className="max-w-5xl mx-auto px-6 flex flex-col items-center text-center">
        {/* Bold Signature Headline */}
        <FadeInUp delay={100}>
          <h1 className="text-center text-4xl sm:text-5xl md:text-[60px] font-semibold sm:font-bold leading-[1.1] tracking-tight text-white max-w-4xl">
            Inteligencia agéntica para decisiones claras.
          </h1>
        </FadeInUp>

        {/* Subheadline in Ash */}
        <FadeInUp delay={160}>
          <p className="mt-5 max-w-xl text-base font-normal leading-relaxed text-[#9c9c9d]">
            Un entorno de ingeniería autónomo con LangGraph, Sidecar de Rust y soporte para Model
            Context Protocol. Tu código permanece 100% en tu máquina.
          </p>
        </FadeInUp>

        {/* App Window Mockup with Tactile Keyboard-Key Treatment & Hover Lift */}
        <FadeInUp delay={300} className="mt-14 w-full max-w-5xl">
          <motion.div
            whileHover={{ scale: 1.012, y: -4 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="rounded-[16px] border border-[#363739] hover:border-white/30 bg-[#07080a] p-2 md:p-3 shadow-key hover:shadow-[0_0_40px_rgba(99,161,255,0.12)] transition-colors cursor-pointer"
          >
            <div className="overflow-hidden rounded-[12px] border border-[#363739] bg-[#040506]">
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-[#363739] bg-[#07080a] px-4 py-2.5 text-left">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-[#ff6363]" />
                  <span className="size-2.5 rounded-full bg-[#fbbf24]" />
                  <span className="size-2.5 rounded-full bg-[#59d499]" />
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#6a6b6c]">
                  Sparta Agent · Command Cockpit
                </span>
                <span className="rounded bg-[#1b1c1e] px-2 py-0.5 font-mono text-[10px] text-[#59d499]">
                  LOCAL IPC ONLINE
                </span>
              </div>

              {/* Main Screenshot Preview */}
              <img
                src={getPublicUrl('proyecto/SPARTAN-PRINCIPAL.png')}
                alt="Sparta Agent Application Interface"
                className="mx-auto block w-full object-contain"
              />
            </div>
          </motion.div>
        </FadeInUp>
      </div>

      {/* Marquee: Engineering Standards */}
      <div className="w-full mt-24">
        <p className="mb-6 text-center font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#6a6b6c]">
          Arquitectura modular impulsada por estándares abiertos
        </p>

        <div className="w-full overflow-hidden mask-linear-fade">
          <div className="flex w-max animate-marquee">
            {marqueeLogos.map((LogoComponent, index) => (
              <div key={index} className="flex-shrink-0 px-8 flex items-center">
                <LogoComponent />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── 3. Skills Ecosystem Showcase ─────────────────────────────────────────────
function SkillsShowcase() {
  const skillsList = [
    {
      title: 'Systematic Debugging',
      desc: 'Diagnóstico de raíz de errores, análisis de stack traces e hipótesis guiadas paso a paso.',
      tag: 'QA // DEBUG',
    },
    {
      title: 'Code Refactoring & AST',
      desc: 'Refactorización arquitectónica, tipado estricto y desacoplamiento limpio en TypeScript y Python.',
      tag: 'ARQUITECTURA',
    },
    {
      title: 'Unit & Integration Testing',
      desc: 'Generación automática de suites de pruebas completas con Vitest, Playwright, Jest y Pytest.',
      tag: 'TESTING',
    },
    {
      title: 'Deep Web Research',
      desc: 'Búsqueda web contextual en tiempo real con recuperación de documentación oficial y RFCs.',
      tag: 'INVESTIGACIÓN',
    },
    {
      title: 'DevOps & Containers',
      desc: 'Creación y diagnóstico de Dockerfiles, docker-compose y pipelines de CI/CD reproducibles.',
      tag: 'INFRAESTRUCTURA',
    },
    {
      title: 'Database Optimization',
      desc: 'Auditoría de esquemas SQL, índices y optimización de consultas en PostgreSQL, MySQL y SQLite.',
      tag: 'BASES DE DATOS',
    },
  ]

  return (
    <section id="skills" className="py-24 px-6 max-w-7xl mx-auto border-t border-[#363739]">
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <FadeInUp>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#363739] bg-[#111214] px-3 py-1 shadow-key">
            <Wrench className="size-3.5 text-[#e6e6e6]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#9c9c9d]">
              Skills & Extensibilidad
            </span>
          </div>
          <h2 className="mt-4 text-3xl font-medium tracking-tight text-white md:text-4xl">
            Habilidades especializadas para cada fase del ciclo de vida.
          </h2>
          <p className="text-base text-[#9c9c9d] leading-relaxed">
            Sparta Agent carga dinámicamente skills contextuales para adaptarse a las convenciones y
            estándares de tu equipo.
          </p>
        </FadeInUp>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skillsList.map((skill, index) => (
          <FadeInUp key={index} delay={index * 60}>
            <motion.div
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
              className="p-6 rounded-[16px] bg-[#07080a] border border-[#363739] space-y-3 shadow-key hover:border-white/30 transition-colors h-full flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[#9c9c9d] px-2 py-0.5 rounded-[6px] bg-[#111214] border border-[#363739]">
                    {skill.tag}
                  </span>
                  <Wrench className="size-3.5 text-[#6a6b6c]" />
                </div>
                <h4 className="text-base font-medium text-white">{skill.title}</h4>
                <p className="text-xs text-[#9c9c9d] leading-relaxed">{skill.desc}</p>
              </div>
            </motion.div>
          </FadeInUp>
        ))}
      </div>
    </section>
  )
}

// ── 4. Downloads Section (Raycast Matrix) ─────────────────────────────────────
function DownloadSection() {
  return (
    <section id="descargas" className="py-24 px-6 max-w-7xl mx-auto border-t border-[#363739]">
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
        <FadeInUp>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#363739] bg-[#111214] px-3 py-1 shadow-key">
            <Download className="size-3.5 text-[#e6e6e6]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#9c9c9d]">
              Descargas Oficiales
            </span>
          </div>
          <h2 className="mt-4 text-3xl font-medium tracking-tight text-white md:text-4xl">
            Disponible para Windows, macOS y Linux.
          </h2>
          <p className="text-base text-[#9c9c9d]">
            Instala la aplicación nativa y comienza a programar con agentes autónomos en segundos.
          </p>
        </FadeInUp>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {/* Windows */}
        <FadeInUp delay={80} className="h-full">
          <motion.div
            whileHover={{ y: -5, scale: 1.015 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            className="p-6 rounded-[16px] bg-[#07080a] border border-[#363739] flex flex-col justify-between space-y-6 shadow-key hover:border-white/30 transition-colors h-full"
          >
            <div className="space-y-3">
              <div className="size-10 rounded-full bg-[#111214] border border-[#363739] flex items-center justify-center text-white shadow-key">
                <Monitor className="size-5" />
              </div>
              <h3 className="text-lg font-medium text-white">Windows</h3>
              <p className="text-xs text-[#9c9c9d]">Windows 10 / 11 (64-bit)</p>
              <div className="pt-2 text-xs text-[#9c9c9d] space-y-1.5 font-mono">
                <div className="flex items-center gap-2 text-[#59d499]">
                  <CheckCircle2 className="size-3.5" /> Instalador Setup .exe
                </div>
                <div className="flex items-center gap-2 text-[#59d499]">
                  <CheckCircle2 className="size-3.5" /> Auto-actualizador incluido
                </div>
              </div>
            </div>

            <BurstLink
              href="https://github.com/Naiker12/Sparta-Agent/releases/latest/download/Sparta-Agent-Windows-0.2.9-Setup.exe"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center bg-[#e6e6e6] hover:bg-white text-[#111214] text-xs font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-button-neutral active:scale-[0.98]"
            >
              <Download className="size-3.5 text-[#111214]" />
              <span>Descargar para Windows (.exe)</span>
            </BurstLink>
          </motion.div>
        </FadeInUp>

        {/* macOS */}
        <FadeInUp delay={140} className="h-full">
          <motion.div
            whileHover={{ y: -5, scale: 1.015 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            className="p-6 rounded-[16px] bg-[#07080a] border border-[#363739] flex flex-col justify-between space-y-6 shadow-key hover:border-white/30 transition-colors h-full"
          >
            <div className="space-y-3">
              <div className="size-10 rounded-full bg-[#111214] border border-[#363739] flex items-center justify-center text-white shadow-key">
                <Apple className="size-5" />
              </div>
              <h3 className="text-lg font-medium text-white">macOS</h3>
              <p className="text-xs text-[#9c9c9d]">Apple Silicon (M1..M4) &amp; Intel</p>
              <div className="pt-2 text-xs text-[#9c9c9d] space-y-1.5 font-mono">
                <div className="flex items-center gap-2 text-[#59d499]">
                  <CheckCircle2 className="size-3.5" /> Paquete Universal .dmg
                </div>
                <div className="flex items-center gap-2 text-[#59d499]">
                  <CheckCircle2 className="size-3.5" /> Aceleración Metal / GPU
                </div>
              </div>
            </div>

            <BurstLink
              href="https://github.com/Naiker12/Sparta-Agent/releases/latest/download/Sparta-Agent-Mac-0.2.9-Installer.dmg"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center bg-[#e6e6e6] hover:bg-white text-[#111214] text-xs font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-button-neutral active:scale-[0.98]"
            >
              <Download className="size-3.5 text-[#111214]" />
              <span>Descargar para macOS (.dmg)</span>
            </BurstLink>
          </motion.div>
        </FadeInUp>

        {/* Linux */}
        <FadeInUp delay={200} className="h-full">
          <motion.div
            whileHover={{ y: -5, scale: 1.015 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            className="p-6 rounded-[16px] bg-[#07080a] border border-[#363739] flex flex-col justify-between space-y-6 shadow-key hover:border-white/30 transition-colors h-full"
          >
            <div className="space-y-3">
              <div className="size-10 rounded-full bg-[#111214] border border-[#363739] flex items-center justify-center text-white shadow-key">
                <Terminal className="size-5" />
              </div>
              <h3 className="text-lg font-medium text-white">Linux</h3>
              <p className="text-xs text-[#9c9c9d]">Ubuntu, Debian, Fedora, Arch</p>
              <div className="pt-2 text-xs text-[#9c9c9d] space-y-1.5 font-mono">
                <div className="flex items-center gap-2 text-[#59d499]">
                  <CheckCircle2 className="size-3.5" /> .AppImage portable &amp; .deb
                </div>
                <div className="flex items-center gap-2 text-[#59d499]">
                  <CheckCircle2 className="size-3.5" /> Integración Bash / Zsh
                </div>
              </div>
            </div>

            <BurstLink
              href="https://github.com/Naiker12/Sparta-Agent/releases/latest/download/Sparta-Agent-Linux-0.2.9.AppImage"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center bg-[#e6e6e6] hover:bg-white text-[#111214] text-xs font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-button-neutral active:scale-[0.98]"
            >
              <Download className="size-3.5 text-[#111214]" />
              <span>Descargar para Linux (.AppImage)</span>
            </BurstLink>
          </motion.div>
        </FadeInUp>
      </div>
    </section>
  )
}

// ── 5. FAQ Section (Raycast Accordion) ────────────────────────────────────────
function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    {
      q: '¿Cómo garantiza Sparta Agent la privacidad de mi código fuente?',
      a: 'Sparta Agent opera bajo una arquitectura Local-First. La indexación de tus archivos, el motor de ejecución LangGraph y la terminal corren directamente en tu máquina. Si usas modelos locales con Ollama o vLLM, tu código jamás sale a internet. Si usas proveedores cloud, las credenciales se custodian localmente en tu vault cifrado.',
    },
    {
      q: '¿Qué modelos de IA son compatibles con Sparta Agent?',
      a: 'Sparta Agent incluye una pasarela agéntica multi-proveedor con soporte inmediato para modelos locales (Ollama, LM Studio, vLLM) y proveedores en la nube (Anthropic Claude 3.7 / 3.5 Sonnet, OpenAI GPT-4o, DeepSeek R1 / V3, Google Gemini 2.5 Flash, OpenRouter y Groq).',
    },
    {
      q: '¿Qué es el protocolo MCP y qué servidores incluye?',
      a: 'Model Context Protocol (MCP) es el estándar abierto para conectar modelos con herramientas externas. Sparta Agent incluye soporte integrado para servidores MCP de Filesystem, PostgreSQL, Git, GitHub, Notion, Slack, Google Drive y Gmail con ejecución segura vía IPC.',
    },
    {
      q: '¿Cómo funciona el diálogo modal de permisos en Modo Agente?',
      a: 'Cada acción que involucre escribir o borrar archivos, ejecutar comandos de terminal o invocar conectores MCP externos activa una tarjeta modal de confirmación previa para que mantengas el control absoluto de cada cambio en tu repositorio.',
    },
    {
      q: '¿Sparta Agent es de código abierto?',
      a: 'Sí. Sparta Agent es un proyecto de código abierto desarrollado para la comunidad de ingeniería de software. Puedes consultar, auditar y contribuir al código fuente en nuestro repositorio oficial de GitHub.',
    },
    {
      q: '¿Puedo personalizar reglas de proyecto y skills de desarrollo?',
      a: 'Sí. Sparta Agent cuenta con soporte nativo para archivos de reglas de proyecto (.agents/AGENTS.md) y catálogo de skills modulares que aprenden de tus preferencias de arquitectura y convenciones de equipo.',
    },
  ]

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="py-24 px-6 max-w-3xl mx-auto border-t border-[#363739]">
      <FadeInUp>
        <h2 className="text-3xl md:text-4xl font-medium text-center text-white mb-12 tracking-tight">
          Preguntas Frecuentes
        </h2>
      </FadeInUp>

      <FadeInUp delay={100}>
        <div className="border border-[#363739] rounded-[16px] bg-[#07080a] overflow-hidden shadow-key">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index
            const isLast = index === faqs.length - 1

            return (
              <div
                key={index}
                className={`${!isLast ? 'border-b border-[#363739]' : ''} transition-colors hover:bg-white/[0.025]`}
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full py-5 px-6 flex items-center justify-between text-left focus:outline-none group cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm text-white font-medium pr-4 group-hover:text-white transition-colors">
                    {faq.q}
                  </span>
                  <div
                    className={`text-[#9c9c9d] group-hover:text-white transform transition-transform duration-200 ease-out flex-shrink-0 ${
                      isOpen ? 'rotate-45 text-white' : 'rotate-0'
                    }`}
                  >
                    <Plus className="size-4" />
                  </div>
                </button>

                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                  }}
                >
                  <div className="overflow-hidden">
                    <p className="text-[#9c9c9d] text-xs pb-5 px-6 leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </FadeInUp>
    </section>
  )
}

// ── 6. Master Unified Footer Section (Encapsulated Master Box) ───────────────
function FooterSection({ onOpenDocs }: { onOpenDocs?: () => void }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer id="contact" className="relative z-0 pt-20 pb-20 px-4 sm:px-6 bg-transparent">
      {/* Master Encapsulated Box */}
      <div className="max-w-5xl mx-auto">
        <FadeInUp>
          <div className="relative overflow-hidden rounded-[24px] border border-[#363739] bg-[#07080a] p-8 sm:p-12 md:p-14 shadow-key">
            {/* Subtle Atmospheric Glows */}
            <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-[#ff6363]/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-[#63a1ff]/10 blur-3xl" />

            {/* Top Section: CTA & Action Buttons */}
            <div className="text-center relative z-10">
              <motion.img
                whileHover={{ scale: 1.08, rotate: [0, -4, 4, 0] }}
                transition={{ duration: 0.35 }}
                src={getPublicUrl('favicon.svg')}
                alt="Sparta Agent Logo"
                className="size-24 sm:size-28 md:size-32 object-contain mx-auto mb-7 drop-shadow-[0_0_36px_rgba(234,179,8,0.55)] cursor-pointer select-none"
                onClick={scrollToTop}
              />

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold sm:font-bold tracking-tight text-white max-w-2xl mx-auto leading-tight">
                Tu atajo a la ingeniería agéntica.
              </h2>

              <p className="text-sm sm:text-base text-[#9c9c9d] max-w-lg mx-auto mt-4 leading-relaxed font-normal">
                Descarga Sparta Agent y experimenta la velocidad del desarrollo autónomo con privacidad
                absoluta en tu propia máquina.
              </p>

              {/* Action Buttons with Burst Effect */}
              <div className="flex flex-wrap items-center gap-3.5 justify-center pt-8">
                <BurstLink
                  href="#descargas"
                  className="bg-[#e6e6e6] hover:bg-white text-[#111214] text-xs font-medium px-5 py-3 rounded-lg transition-all shadow-button-neutral flex items-center gap-2 active:scale-[0.98]"
                >
                  <Download className="size-4 text-[#111214]" />
                  <span>Descargar Sparta Agent</span>
                </BurstLink>

                <BurstLink
                  href="https://github.com/Naiker12/Sparta-Agent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#111214] hover:bg-[#1b1c1e] text-white text-xs font-medium px-4.5 py-3 rounded-lg border border-[#363739] transition-all flex items-center gap-2 shadow-key active:scale-[0.98]"
                >
                  <span>Ver código en GitHub</span>
                  <ExternalLink className="size-3.5 text-[#9c9c9d]" />
                </BurstLink>
              </div>

              {/* Technical Indicators */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-6 font-mono text-[11px] text-[#6a6b6c] pt-4">
                <span className="flex items-center gap-1.5 text-[#9c9c9d]">
                  <CheckCircle2 className="size-3.5 text-[#59d499]" />
                  100% Local-First
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-[#9c9c9d]">
                  <CheckCircle2 className="size-3.5 text-[#59d499]" />
                  Protocolo MCP Seguro
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-[#9c9c9d]">
                  <CheckCircle2 className="size-3.5 text-[#59d499]" />
                  Código Abierto
                </span>
              </div>
            </div>

            {/* Inner Divider */}
            <div className="border-t border-[#363739]/60 my-10 relative z-10" />

            {/* Middle Section: 4-Column Directory Grid (Inside the box) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 text-left relative z-10">
              {/* Col 1: Brand */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src={getPublicUrl('favicon.svg')}
                    alt="Sparta Agent"
                    className="size-5 object-contain drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]"
                  />
                  <span className="font-medium text-sm tracking-tight text-white">Sparta Agent</span>
                  <span className="font-mono text-[10px] text-[#9c9c9d] px-1.5 py-0.5 rounded-[6px] bg-[#111214] border border-[#363739]">
                    v0.2.9
                  </span>
                </div>

                <p className="text-xs text-[#9c9c9d] leading-relaxed">
                  IDE Agéntico Local-First con LangGraph, Rust, soporte MCP y privacidad absoluta.
                </p>
              </div>

              {/* Col 2: Producto */}
              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#9c9c9d] mb-3">Producto</h4>
                <ul className="space-y-2 text-xs text-[#6a6b6c]">
                  <li>
                    <a href="#producto" className="hover:text-white transition-colors flex items-center gap-1 group">
                      <span className="group-hover:translate-x-1 transition-transform">Capacidades</span>
                    </a>
                  </li>
                  <li>
                    <a href="#flujo-agentico" className="hover:text-white transition-colors flex items-center gap-1 group">
                      <span className="group-hover:translate-x-1 transition-transform">Flujo Agéntico</span>
                    </a>
                  </li>
                  <li>
                    <a href="#mcp" className="hover:text-white transition-colors flex items-center gap-1 group">
                      <span className="group-hover:translate-x-1 transition-transform">Conectores MCP</span>
                    </a>
                  </li>
                  <li>
                    <a href="#skills" className="hover:text-white transition-colors flex items-center gap-1 group">
                      <span className="group-hover:translate-x-1 transition-transform">Skills &amp; Herramientas</span>
                    </a>
                  </li>
                  <li>
                    <a href="#descargas" className="hover:text-white transition-colors flex items-center gap-1 group">
                      <span className="group-hover:translate-x-1 transition-transform">Descargas Oficiales</span>
                    </a>
                  </li>
                </ul>
              </div>

              {/* Col 3: Recursos */}
              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#9c9c9d] mb-3">Recursos</h4>
                <ul className="space-y-2 text-xs text-[#6a6b6c]">
                  <li>
                    <button
                      onClick={onOpenDocs}
                      className="hover:text-white text-left transition-colors flex items-center gap-1.5 cursor-pointer group"
                    >
                      <span className="group-hover:translate-x-1 transition-transform">Documentación (Docs)</span>
                      <BookOpen className="size-3 text-[#9c9c9d]" />
                    </button>
                  </li>
                  <li>
                    <a href="https://github.com/Naiker12/Sparta-Agent" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1 group">
                      <span className="group-hover:translate-x-1 transition-transform">Código en GitHub</span>
                      <ExternalLink className="size-3 text-[#6a6b6c]" />
                    </a>
                  </li>
                  <li>
                    <a href="https://github.com/Naiker12/Sparta-Agent/releases" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1 group">
                      <span className="group-hover:translate-x-1 transition-transform">Registro de Versiones</span>
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className="hover:text-white transition-colors flex items-center gap-1 group">
                      <span className="group-hover:translate-x-1 transition-transform">Preguntas Frecuentes</span>
                    </a>
                  </li>
                </ul>
              </div>

              {/* Col 4: Comunidad */}
              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#9c9c9d] mb-3">Comunidad</h4>
                <ul className="space-y-2 text-xs text-[#6a6b6c]">
                  <li>
                    <a href="https://github.com/Naiker12/Sparta-Agent/issues" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1 group">
                      <span className="group-hover:translate-x-1 transition-transform">Reportar un Bug</span>
                    </a>
                  </li>
                  <li>
                    <a href="https://github.com/Naiker12/Sparta-Agent/discussions" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1 group">
                      <span className="group-hover:translate-x-1 transition-transform">Discusiones de Desarrollo</span>
                    </a>
                  </li>
                  <li>
                    <a href="https://github.com/Naiker12/Sparta-Agent" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1 group">
                      <span className="group-hover:translate-x-1 transition-transform">Contribuir al Proyecto</span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom Inner Meta Strip */}
            <div className="border-t border-[#363739]/50 pt-6 mt-10 flex flex-col md:flex-row justify-between items-center gap-3 font-mono text-[11px] text-[#6a6b6c] text-center relative z-10">
              <span>© 2026 Sparta Agent. Licencia de Código Abierto</span>

              <div className="flex items-center gap-3">
                <span>Electron + Rust + LangGraph</span>
                <span>•</span>
                <span>Model Context Protocol</span>
              </div>

              <button
                onClick={scrollToTop}
                className="hover:text-white transition-colors flex items-center gap-1 text-xs cursor-pointer"
              >
                <span>Volver arriba ↑</span>
              </button>
            </div>
          </div>
        </FadeInUp>
      </div>
    </footer>
  )
}

// ── Main App Router Component ────────────────────────────────────────────────
export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'docs'>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname.includes('/docs') ||
        new URLSearchParams(window.location.search).has('docs') ||
        window.location.hash === '#docs'
        ? 'docs'
        : 'landing'
    }
    return 'landing'
  })

  useEffect(() => {
    const handlePopState = () => {
      const isDocs =
        window.location.pathname.includes('/docs') ||
        new URLSearchParams(window.location.search).has('docs') ||
        window.location.hash === '#docs'
      setCurrentView(isDocs ? 'docs' : 'landing')
    }
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('hashchange', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('hashchange', handlePopState)
    }
  }, [])

  const openDocs = () => {
    setCurrentView('docs')
    window.history.pushState(null, '', '?docs=inicio')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const backToLanding = () => {
    setCurrentView('landing')
    window.history.pushState(null, '', window.location.pathname)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (currentView === 'docs') {
    return <DocsPage onBackToLanding={backToLanding} />
  }

  return (
    <div className="min-h-screen bg-[#040506] text-white selection:bg-[#ff6363]/20 selection:text-white font-sans antialiased overflow-x-hidden relative">
      <InteractiveSpiderWeb />
      <Navbar onOpenDocs={openDocs} />
      <main className="relative z-10">
        <HeroSection />
        <ProductTour />
        <McpGraphShowcase />
        <SkillsShowcase />
        <DownloadSection />
        <FaqSection />
      </main>
      <FooterSection onOpenDocs={openDocs} />
      <ReleaseModal />
    </div>
  )
}
