import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
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
} from 'lucide-react'
import { DocsPage } from './components/docs/docs-page'
import { ProductTour } from './components/sections/product-tour'
import { ReleaseModal } from './components/ui/release-modal'
import { getPublicUrl } from './lib/utils'

// ── SVG Brand & Technology Icons for Marquee ─────────────────────────────────
function SvgReact() {
  return (
    <div className="flex items-center gap-2.5 text-gray-400 hover:text-white transition-colors">
      <svg className="w-5 h-5" viewBox="-11.5 -10.23174 23 20.46348" fill="#61DAFB">
        <circle cx="0" cy="0" r="2.05" />
        <g stroke="#61DAFB" strokeWidth="1" fill="none">
          <ellipse rx="11" ry="4.2" />
          <ellipse rx="11" ry="4.2" transform="rotate(60)" />
          <ellipse rx="11" ry="4.2" transform="rotate(120)" />
        </g>
      </svg>
      <span className="font-semibold text-xs tracking-wider">REACT</span>
    </div>
  )
}

function SvgTypeScript() {
  return (
    <div className="flex items-center gap-2.5 text-gray-400 hover:text-white transition-colors">
      <svg className="w-5 h-5" viewBox="0 0 128 128" fill="none">
        <rect width="128" height="128" rx="16" fill="#3178C6" />
        <path d="M72 80v24h12V80h16V68H56v12h16zm-36-4h12c0-8.8 4-13 11-13s11 4.2 11 10.5c0 6.5-4.5 9.5-12 14.5C44 96 36 102 36 114c0 14 11 22 25 22 15 0 25-9 25-23H74c0 7.5-4 12-13 12s-13-4.5-13-11c0-7 5-10 13-15.5 14-8.5 21-14.5 21-25.5 0-14-10-21-23-21-14 0-23 8-23 23z" fill="#FFF" />
      </svg>
      <span className="font-semibold text-xs tracking-wider">TYPESCRIPT</span>
    </div>
  )
}

function SvgPython() {
  return (
    <div className="flex items-center gap-2.5 text-gray-400 hover:text-white transition-colors">
      <svg className="w-5 h-5" viewBox="0 0 128 128">
        <path fill="#3776AB" d="M63.8 0c-16.8 0-31.5 1.5-31.5 15.3v11.5h31.5v3.8H18.7C8 30.6 0 38.6 0 53.5s7.4 22.9 18.7 22.9h10.9V64.8c0-12.7 11.2-22.9 22.9-22.9h31.5c10.8 0 19.1-8.5 19.1-19.1V15.3C103.1 1.5 80.6 0 63.8 0zm-8.8 9.3c3.2 0 5.7 2.6 5.7 5.7s-2.6 5.7-5.7 5.7-5.7-2.6-5.7-5.7 2.6-5.7 5.7-5.7z" />
        <path fill="#FFD43B" d="M64.2 128c16.8 0 31.5-1.5 31.5-15.3v-11.5H64.2v-3.8h45.1c10.7 0 18.7-8 18.7-22.9s-7.4-22.9-18.7-22.9H98.4v11.6c0 12.7-11.2 22.9-22.9 22.9H44c-10.8 0-19.1 8.5-19.1 19.1v11.6c0 13.8 22.5 15.3 39.3 15.3zm8.8-9.3c-3.2 0-5.7-2.6-5.7-5.7s2.6-5.7 5.7-5.7 5.7 2.6 5.7 5.7-2.6 5.7-5.7 5.7z" />
      </svg>
      <span className="font-semibold text-xs tracking-wider">LANGGRAPH / PYTHON</span>
    </div>
  )
}

function SvgDocker() {
  return (
    <div className="flex items-center gap-2.5 text-gray-400 hover:text-white transition-colors">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#2496ED">
        <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186H11.03a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.186v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.186v1.888c0 .102.084.185.186.185m-2.928 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H2.208a.186.186 0 00-.186.186v1.888c0 .102.084.185.186.185M23.79 9.89a4.84 4.84 0 00-1.89-2.02 6.94 6.94 0 00-.47-.26.24.24 0 00-.28.06c-.35.39-.75.73-1.19 1a6.6 6.6 0 01-2.93.92H.39c-.19 0-.35.15-.38.34-.33 2.1-.06 4.3 1.05 6.18 1.48 2.5 3.92 4.14 6.78 4.6 3.96.64 8.08.06 11.75-1.74a12.8 12.8 0 004.14-3.3c.12-.14.07-.37-.1-.47-.4-.24-.76-.54-1.07-.88a.22.22 0 01-.04-.26 3.86 3.86 0 00.57-2.18c0-.7-.18-1.39-.51-2.01a.22.22 0 01.07-.28c.41-.26.83-.49 1.28-.68.14-.06.2-.23.13-.37z" />
      </svg>
      <span className="font-semibold text-xs tracking-wider">DOCKER</span>
    </div>
  )
}

function SvgRust() {
  return (
    <div className="flex items-center gap-2.5 text-gray-400 hover:text-white transition-colors">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#DEA584">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M8 8h8M8 12h8M8 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="font-semibold text-xs tracking-wider">RUST CORE</span>
    </div>
  )
}

function SvgPostgres() {
  return (
    <div className="flex items-center gap-2.5 text-gray-400 hover:text-white transition-colors">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#4169E1">
        <ellipse cx="12" cy="6" rx="9" ry="3" />
        <path d="M3 6v6c0 1.66 4.03 3 9 3s9-1.34 9-3V6" fill="none" stroke="#4169E1" strokeWidth="2" />
        <path d="M3 12v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" fill="none" stroke="#4169E1" strokeWidth="2" />
      </svg>
      <span className="font-semibold text-xs tracking-wider">POSTGRESQL MCP</span>
    </div>
  )
}

// ── FadeInUp Scroll Reveal Component ─────────────────────────────────────────
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
        transitionDuration: '1000ms',
        transitionDelay: `${delay}ms`,
      }}
      className={`transition-all ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      } ${className}`}
    >
      {children}
    </div>
  )
}

// ── SVG Docs Icon ────────────────────────────────────────────────────────────
function SvgDocsIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M6 6h10" />
      <path d="M6 10h10" />
      <path d="M6 14h6" />
    </svg>
  )
}

// ── 1. Navigation Bar (Sticky & Responsive) ──────────────────────────────────
function Navbar({ onOpenDocs }: { onOpenDocs: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeLink, setActiveLink] = useState('#flujo-agentico')

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'Flujo Agéntico', href: '#flujo-agentico' },
    { name: 'Conectores MCP', href: '#mcp' },
    { name: 'Arquitectura', href: '#arquitectura' },
    { name: 'Seguridad', href: '#seguridad' },
    { name: 'Skills', href: '#skills' },
    { name: 'Descargas', href: '#descargas' },
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
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-black/90 backdrop-blur-xl py-4 shadow-2xl' : 'bg-black/80 backdrop-blur-xl py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Brand Logo */}
        <a
          href="#about"
          onClick={(e) => {
            e.preventDefault()
            scrollTo('#about')
          }}
          className="flex items-center gap-3 group select-none"
        >
          <img
            src={getPublicUrl('favicon.svg')}
            alt="Sparta Agent Logo"
            className="w-8 h-8 object-contain drop-shadow-[0_0_12px_rgba(234,179,8,0.5)] group-hover:scale-110 transition-transform"
          />
          <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Sparta Agent
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10 font-bold tracking-wider">
              BETA
            </span>
          </span>
        </a>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-1 bg-white/[0.035] px-2 py-2 rounded-full border border-white/15 backdrop-blur-md shadow-[0_12px_36px_rgba(0,0,0,0.28)]">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => {
                e.preventDefault()
                scrollTo(link.href)
              }}
              className={`relative isolate px-4 py-2.5 text-sm font-semibold transition-colors ${activeLink === link.href ? 'text-white' : 'text-gray-300 hover:text-white'}`}
            >
              {activeLink === link.href && (
                <motion.span
                  layoutId="active-nav-link"
                  className="absolute inset-0 -z-10 rounded-full border border-white/15 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                />
              )}
              {link.name}
            </a>
          ))}
        </div>

        {/* Desktop Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://github.com/Naiker12/Sparta-Agent"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-11 items-center gap-2 rounded-full border border-white/15 bg-[#1F1F22] px-5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#2A2A2D] hover:shadow-lg hover:shadow-black/30"
          >
            <span>GitHub</span>
            <ExternalLink className="size-5 text-gray-300 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
          <button
            onClick={onOpenDocs}
            className="group flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-violet-100 hover:shadow-violet-300/25 cursor-pointer"
          >
            <SvgDocsIcon className="size-5 text-black transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]" />
            <span>Docs</span>
          </button>
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 text-gray-400 hover:text-white focus:outline-none"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-black/95 backdrop-blur-2xl border-b border-white/10 px-6 py-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => {
                e.preventDefault()
                scrollTo(link.href)
              }}
              className="block text-sm font-medium text-gray-300 hover:text-white py-2"
            >
              {link.name}
            </a>
          ))}
          <div className="pt-4 border-t border-white/10 flex gap-3">
            <button
              onClick={() => {
                setMobileOpen(false)
                onOpenDocs()
              }}
              className="flex-1 text-center bg-white text-black text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <SvgDocsIcon className="w-3.5 h-3.5" />
              <span>Documentación</span>
            </button>
            <a
              href="https://github.com/Naiker12/Sparta-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center bg-[#1F1F22] text-white text-xs font-medium py-3 rounded-xl border border-white/10 flex items-center justify-center gap-1.5"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}

// ── 2. Hero Section ──────────────────────────────────────────────────────────
function HeroSection() {
  const techLogos = [
    SvgReact,
    SvgTypeScript,
    SvgPython,
    SvgDocker,
    SvgRust,
    SvgPostgres,
  ]

  const marqueeLogos = [...techLogos, ...techLogos, ...techLogos, ...techLogos]

  return (
    <section id="about" className="relative z-0 flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black pb-12 pt-28">
      <video autoPlay loop muted playsInline className="pointer-events-none absolute inset-0 -z-10 size-full object-cover opacity-90">
        <source src="https://cdn.sceneai.art/Hero%20Section%20Video/50b4f304-cdca-4e12-8735-580d225834be.mp4" type="video/mp4" />
      </video>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-black/20 to-black" />

      <div className="max-w-5xl mx-auto px-6 flex flex-col items-center text-center">
        {/* Headline */}
        <FadeInUp delay={100}>
          <h1 className="text-center text-5xl font-medium leading-[1.05] tracking-tight text-white md:text-7xl">
            Inteligencia para <br className="hidden md:block" />
            <span className="font-serif italic font-normal text-violet-300">decisiones claras.</span>
          </h1>
        </FadeInUp>

        <FadeInUp delay={220} className="mt-10 w-full max-w-6xl">
          <div className="group rounded-2xl border border-white/15 bg-black/60 p-2 shadow-2xl shadow-black/60 backdrop-blur-sm transition-transform duration-700 ease-out hover:-translate-y-1 md:p-3">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0c10]">
              <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-left">
                <span className="size-2 rounded-full bg-red-400/70" />
                <span className="size-2 rounded-full bg-amber-300/70" />
                <span className="size-2 rounded-full bg-emerald-400/70" />
                <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.16em] text-gray-400">Sparta Agent · Vista de aplicación</span>
              </div>
              <img src={getPublicUrl('proyecto/SPARTAN-PRINCIPAL.png')} alt="Pantalla principal de la aplicación Sparta Agent" className="mx-auto block w-full object-contain transition-transform duration-1000 ease-out motion-safe:group-hover:scale-[1.012]" />
            </div>
          </div>
        </FadeInUp>
      </div>

      {/* Marquee (Technologies & Ecosystem) */}
      <div className="w-full mt-24">
        <p className="mb-8 text-center text-[11px] font-mono font-semibold uppercase tracking-widest text-gray-500">
          ARQUITECTURA MODULAR IMPULSADA POR ESTÁNDARES ABIERTOS
        </p>

        {/* Wrapper with edge fading mask */}
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

// ── 3. Feature 1: IDE Agéntico & Chat de Ingeniería ─────────────────────────
function FeatureAiChat() {
  return (
    <section id="flujo-agentico" className="py-28 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left Text */}
        <FadeInUp delay={100} className="space-y-6">
          <h2 className="text-4xl md:text-5xl font-semibold text-white tracking-tight leading-tight">
            Donde la velocidad converge con la inteligencia de ingeniería.
          </h2>
          <p className="text-gray-400 text-base leading-relaxed">
            Un asistente de programación que entiende tu arquitectura completa, desglosa tareas complejas en planes paso a paso y ejecuta cambios en tus archivos bajo tu estricta supervisión y permisos.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-2 text-xs text-gray-300">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
              <span className="font-mono text-white block mb-1 font-semibold text-xs">LangGraph State Machine</span>
              <p className="text-gray-400 text-[11px] leading-relaxed">Ciclos autónomos de razonamiento, inspección de código y auto-corrección.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
              <span className="font-mono text-white block mb-1 font-semibold text-xs">Permission Broker</span>
              <p className="text-gray-400 text-[11px] leading-relaxed">Diálogo modal con confirmación explícita previa a cada edición o comando.</p>
            </div>
          </div>
        </FadeInUp>

        {/* Right Mockup */}
        <FadeInUp delay={250}>
          <div className="rounded-3xl overflow-hidden p-6 md:p-8 border border-white/10 relative min-h-[440px] flex items-center justify-center shadow-2xl">
            {/* Background Video */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 object-cover w-full h-full"
            >
              <source
                src="https://cdn.sceneai.art/Hero%20Section%20Video/1bcc8fa3-37f6-4c53-8591-0347e4c7f8ac.mp4"
                type="video/mp4"
              />
            </video>
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />

            {/* Floating Card Mockup */}
            <div className="bg-[#141416]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-5 w-full max-w-md shadow-2xl relative z-10 space-y-4">
              {/* Top Workflow Category Chips */}
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-300 flex items-center gap-1.5">
                  <Code2 className="w-3 h-3 text-amber-300" /> Crear con IA
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-300 flex items-center gap-1.5">
                  <Search className="w-3 h-3 text-blue-300" /> Analizar Código
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-300 flex items-center gap-1.5">
                  <Bot className="w-3 h-3 text-emerald-300" /> Agente Sparta
                </span>
              </div>

              {/* Sample Response Bubble */}
              <div className="bg-black/50 rounded-xl p-3.5 border border-white/10 space-y-2 text-xs text-gray-300 leading-relaxed">
                <div className="flex items-center justify-between font-medium text-white pb-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <img src="/favicon.svg" alt="Sparta" className="w-4 h-4" />
                    <span>Sparta Agent</span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-mono">Modo Agente Activo</span>
                </div>
                <p>
                  He analizado el microservicio de autenticación. Generé un plan de 3 pasos para implementar tokens JWT con el vault local de Sparta.
                </p>
                <div className="p-2 bg-white/5 rounded border border-white/5 text-[11px] font-mono text-emerald-400">
                  [ OK ] 3 archivos analizados · 0 filtraciones a la nube
                </div>
              </div>

              {/* Compose Box */}
              <div className="bg-black/70 border border-white/15 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="Pregunta o describe la tarea técnica..."
                  readOnly
                  className="bg-transparent text-xs text-gray-300 placeholder-gray-500 focus:outline-none flex-1"
                />
                <div className="w-7 h-7 rounded-lg bg-white/10 text-white border border-white/10 flex items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </FadeInUp>
      </div>
    </section>
  )
}

// ── 4. Feature 2: Protocolo MCP & Ecosistema de Herramientas ─────────────────
function FeatureMcpEcosystem() {
  return (
    <section id="mcp" className="py-28 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left Mockup */}
        <FadeInUp delay={150} className="order-2 lg:order-1">
          <div className="rounded-3xl overflow-hidden p-6 md:p-8 border border-white/10 relative min-h-[440px] flex items-center justify-center shadow-2xl">
            {/* Background Video */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 object-cover w-full h-full"
            >
              <source
                src="https://cdn.sceneai.art/Hero%20Section%20Video/736fd4a0-70ac-4f44-9633-55769ead6aca.mp4"
                type="video/mp4"
              />
            </video>
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />

            {/* Floating Card Mockup */}
            <div className="bg-[#141416]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-5 w-full max-w-md shadow-2xl relative z-10 space-y-3.5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-semibold text-white">Servidores MCP Conectados</h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  IPC Bridge 100% OK
                </span>
              </div>

              {/* MCP Connectors List */}
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <FolderOpen className="w-4 h-4 text-blue-400" />
                    <span>Filesystem (Local-First)</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">read_file, write_file</span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Database className="w-4 h-4 text-purple-400" />
                    <span>PostgreSQL Database</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">query, schema</span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <GitBranch className="w-4 h-4 text-amber-400" />
                    <span>Git & GitHub Connector</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">diff, commit, branch</span>
                </div>
              </div>
            </div>
          </div>
        </FadeInUp>

        {/* Right Text */}
        <FadeInUp delay={250} className="order-1 lg:order-2 space-y-6">
          <h2 className="text-4xl md:text-5xl font-semibold text-white tracking-tight leading-tight">
            Conecta tus herramientas, bases de datos y APIs sin fricción.
          </h2>
          <p className="text-gray-400 text-base leading-relaxed">
            Sparta Agent implementa el estándar abierto <strong>Model Context Protocol (MCP)</strong> con canal IPC seguro y gestión de permisos, permitiendo que tu agente interactúe con bases de datos, APIs, Notion, Slack y Google Drive de forma transparente y auditable.
          </p>
          <div className="pt-2">
            <a
              href="#descargas"
              className="bg-white hover:bg-gray-100 text-black text-sm font-semibold px-6 py-3 rounded-full transition-all inline-flex items-center gap-2 shadow-lg"
            >
              <span>Explorar Sparta Agent</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </FadeInUp>
      </div>
    </section>
  )
}

// ── 5. Feature 3: Arquitectura y Seguridad ───────────────────────────────────
function FeatureArchitecture() {
  return (
    <section id="arquitectura" className="py-28 px-6 max-w-7xl mx-auto border-t border-white/5">
      <div className="text-center max-w-3xl mx-auto mb-20">
        <FadeInUp>
          <h2 className="text-4xl md:text-5xl font-semibold text-white tracking-tight">
            Tu código nunca sale de tu máquina.
          </h2>
          <p className="text-gray-400 text-base mt-4">
            A diferencia de los asistentes basados 100% en la nube, Sparta Agent ejecuta el motor agéntico en tu entorno local con soporte para modelos locales (Ollama/vLLM) y pasarela de proveedores cifrada.
          </p>
        </FadeInUp>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <FadeInUp delay={100} className="p-7 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4 hover:border-white/20 transition-all">
          <div className="w-12 h-12 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">Sidecar Python & Rust</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Motor de alto rendimiento con indexación de código en memoria, grafos LangGraph y bindings directos de bajo consumo de recursos.
          </p>
        </FadeInUp>

        <FadeInUp delay={200} className="p-7 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4 hover:border-white/20 transition-all">
          <div className="w-12 h-12 rounded-xl bg-blue-400/10 text-blue-400 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">Local Vault de Secretos</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Tus API keys (OpenAI, Anthropic, OpenRouter, Google) se custodian localmente con cifrado AES-256 en el keychain de tu sistema operativo.
          </p>
        </FadeInUp>

        <FadeInUp delay={300} className="p-7 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4 hover:border-white/20 transition-all">
          <div className="w-12 h-12 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center">
            <Terminal className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">Terminal Integrada Multi-Shell</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Ejecución nativa de comandos con emulación completa, gestión de procesos en segundo plano y auditoría en tiempo real.
          </p>
        </FadeInUp>
      </div>
    </section>
  )
}

// ── 6. Skills & Extensibility Showcase ───────────────────────────────────────
function SkillsShowcase() {
  const skillsList = [
    { title: 'Systematic Debugging', desc: 'Diagnóstico de raíz de errores, inspección de trazas y generación de hipótesis guiadas.', tag: 'QA & Debug' },
    { title: 'Code Refactoring', desc: 'Refactorización SOLID, desacoplamiento de dependencias y tipado estricto en TypeScript y Python.', tag: 'Arquitectura' },
    { title: 'API & Unit Test Generation', desc: 'Creación automatizada de suites de pruebas con Vitest, Playwright, Jest y Pytest.', tag: 'Testing' },
    { title: 'Deep Web Research', desc: 'Búsqueda web contextual en tiempo real con recuperación de documentación oficial y RFCs.', tag: 'Investigación' },
    { title: 'DevOps & Containerization', desc: 'Creación y diagnóstico de Dockerfiles, docker-compose y pipelines de CI/CD.', tag: 'Infraestructura' },
    { title: 'Database Optimization', desc: 'Auditoría de esquemas SQL, índices y optimización de consultas en PostgreSQL y MySQL.', tag: 'Bases de Datos' },
  ]

  return (
    <section id="skills" className="py-28 px-6 max-w-7xl mx-auto border-t border-white/5">
      <div className="text-center max-w-3xl mx-auto mb-20">
        <FadeInUp>
          <h2 className="text-4xl md:text-5xl font-semibold text-white tracking-tight">
            Habilidades especializadas para cada fase del ciclo de vida.
          </h2>
          <p className="text-gray-400 text-base mt-4">
            Sparta Agent carga dinámicamente skills contextuales para adaptarse a las convenciones de tu equipo y lenguaje de desarrollo.
          </p>
        </FadeInUp>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skillsList.map((skill, index) => (
          <FadeInUp key={index} delay={index * 80} className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-gray-400 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/5">
                {skill.tag}
              </span>
              <Wrench className="w-4 h-4 text-gray-500" />
            </div>
            <h4 className="text-base font-semibold text-white">{skill.title}</h4>
            <p className="text-xs text-gray-400 leading-relaxed">{skill.desc}</p>
          </FadeInUp>
        ))}
      </div>
    </section>
  )
}

// ── 7. Downloads Section ─────────────────────────────────────────────────────
function DownloadSection() {
  return (
    <section id="descargas" className="py-28 px-6 max-w-7xl mx-auto border-t border-white/5">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <FadeInUp>
          <h2 className="text-4xl md:text-5xl font-semibold text-white tracking-tight">
            Disponible para Windows, macOS y Linux.
          </h2>
          <p className="text-gray-400 text-base mt-3">
            Instala la aplicación de escritorio y comienza a programar con agentes autónomos en menos de 2 minutos.
          </p>
        </FadeInUp>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {/* Windows */}
        <FadeInUp delay={100} className="p-8 rounded-3xl bg-[#141416] border border-white/15 flex flex-col justify-between space-y-6 hover:border-white/30 transition-all shadow-2xl">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Monitor className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Windows</h3>
            <p className="text-xs text-gray-400">Windows 10 / 11 (64-bit)</p>
            <div className="pt-2 text-xs text-gray-300 space-y-1.5 font-mono">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Instalador Setup .exe
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Auto-actualizador incluido
              </div>
            </div>
          </div>
          <a
            href="https://github.com/Naiker12/Sparta-Agent/releases/latest/download/Sparta-Agent-Windows-0.1.9-Setup.exe"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-center bg-white hover:bg-gray-100 text-black text-xs font-bold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02]"
          >
            <Download className="w-4 h-4" />
            <span>Descargar para Windows (.exe)</span>
          </a>
        </FadeInUp>

        {/* macOS */}
        <FadeInUp delay={200} className="p-8 rounded-3xl bg-[#141416] border border-white/15 flex flex-col justify-between space-y-6 hover:border-white/30 transition-all shadow-2xl">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center">
              <Apple className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">macOS</h3>
            <p className="text-xs text-gray-400">Apple Silicon (M1/M2/M3/M4) & Intel</p>
            <div className="pt-2 text-xs text-gray-300 space-y-1.5 font-mono">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Paquete Universal .dmg
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aceleración Metal / GPU
              </div>
            </div>
          </div>
          <a
            href="https://github.com/Naiker12/Sparta-Agent/releases/latest/download/Sparta-Agent-Mac-0.1.9-Installer.dmg"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-center bg-white hover:bg-gray-100 text-black text-xs font-bold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02]"
          >
            <Download className="w-4 h-4" />
            <span>Descargar para macOS (.dmg)</span>
          </a>
        </FadeInUp>

        {/* Linux */}
        <FadeInUp delay={300} className="p-8 rounded-3xl bg-[#141416] border border-white/15 flex flex-col justify-between space-y-6 hover:border-white/30 transition-all shadow-2xl">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Terminal className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Linux</h3>
            <p className="text-xs text-gray-400">Ubuntu, Debian, Fedora, Arch</p>
            <div className="pt-2 text-xs text-gray-300 space-y-1.5 font-mono">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> .AppImage portable & .deb
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Integración nativa Bash/Zsh
              </div>
            </div>
          </div>
          <a
            href="https://github.com/Naiker12/Sparta-Agent/releases/latest/download/Sparta-Agent-Linux-0.1.9.AppImage"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-center bg-white hover:bg-gray-100 text-black text-xs font-bold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02]"
          >
            <Download className="w-4 h-4" />
            <span>Descargar para Linux (.AppImage)</span>
          </a>
        </FadeInUp>
      </div>
    </section>
  )
}

// ── 8. FAQ Section ───────────────────────────────────────────────────────────
function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    {
      q: '¿Cómo garantiza Sparta Agent la privacidad de mi código fuente?',
      a: 'Sparta Agent opera bajo una arquitectura Local-First. La indexación de tus archivos, el grafo LangGraph y la terminal corren en tu propia máquina. Si usas modelos locales con Ollama o vLLM, tu código jamás sale a internet. Si usas proveedores cloud, las credenciales se custodian en tu vault cifrado del sistema operativo.',
    },
    {
      q: '¿Qué modelos de IA puedo utilizar en Sparta Agent?',
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
      q: '¿Puedo sincronizar memorias semánticas y skills personalizadas?',
      a: 'Sí. Sparta Agent cuenta con un sistema de memoria semántica a largo plazo y catálogo de skills modulares que aprenden de tus preferencias de arquitectura y convenciones de equipo.',
    },
  ]

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="py-32 px-6 max-w-3xl mx-auto border-t border-white/5">
      <FadeInUp>
        <h2 className="text-4xl md:text-5xl font-semibold text-center text-white mb-12 tracking-tight">
          Preguntas Frecuentes
        </h2>
      </FadeInUp>

      <FadeInUp delay={150}>
        <div className="border border-white/10 rounded-2xl bg-transparent overflow-hidden">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index
            const isLast = index === faqs.length - 1

            return (
              <div
                key={index}
                className={`${!isLast ? 'border-b border-white/10' : ''} transition-colors`}
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full py-6 px-6 flex items-center justify-between text-left focus:outline-none group"
                  aria-expanded={isOpen}
                >
                  <span className="text-base text-white font-medium pr-4 group-hover:text-amber-200 transition-colors">
                    {faq.q}
                  </span>
                  <div
                    className={`text-gray-400 transform transition-transform duration-300 ease-out flex-shrink-0 ${
                      isOpen ? 'rotate-45 text-white' : 'rotate-0'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                  </div>
                </button>

                {/* Smooth CSS Grid Transition Accordion */}
                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                  }}
                >
                  <div className="overflow-hidden">
                    <p className="text-gray-400 text-sm pb-6 px-6 leading-relaxed">
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

// ── 9. Footer Section ────────────────────────────────────────────────────────
function FooterSection({ onOpenDocs }: { onOpenDocs?: () => void }) {
  return (
    <footer id="contact" className="relative z-0 pt-32 pb-10 px-6 border-t border-white/5 overflow-hidden">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-40 -z-10 pointer-events-none"
      >
        <source
          src="https://cdn.sceneai.art/Hero%20Section%20Video/50b4f304-cdca-4e12-8735-580d225834be.mp4"
          type="video/mp4"
        />
      </video>

      {/* Dark gradient overlay for clean contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black -z-10 pointer-events-none" />

      {/* Top CTA */}
      <div className="max-w-4xl mx-auto text-center mb-32">
        <FadeInUp>
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-white mb-8">
            ¿Listo para acelerar tu desarrollo <br />
            con <span className="font-serif italic font-normal text-amber-200">agentes autónomos?</span>
          </h2>
        </FadeInUp>

        <FadeInUp delay={150}>
          <div className="flex flex-row items-center gap-4 justify-center">
            <a
              href="#descargas"
              className="bg-white hover:bg-gray-100 text-black text-sm font-semibold px-7 py-3.5 rounded-full transition-all shadow-xl hover:shadow-white/20 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Sparta Agent</span>
            </a>
            <a
              href="https://github.com/Naiker12/Sparta-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#1F1F22] hover:bg-[#2A2A2D] text-white text-sm font-medium px-6 py-3.5 rounded-full border border-white/10 transition-all flex items-center gap-2"
            >
              <span>Ver en GitHub</span>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          </div>
        </FadeInUp>
      </div>

      {/* Link Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-7xl mx-auto mb-24">
        {/* Col 1: Sparta Agent Brand */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img src={getPublicUrl('favicon.svg')} alt="Sparta Agent" className="w-7 h-7" />
            <span className="text-xl font-bold tracking-tight text-white">Sparta Agent</span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            IDE Agéntico Local-First con LangGraph, Rust, soporte MCP y privacidad absoluta para desarrolladores.
          </p>
        </div>

        {/* Col 2: Producto */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-4">Producto</h4>
          <ul className="space-y-2.5 text-sm text-gray-400">
            <li><a href="#flujo-agentico" className="hover:text-white transition-colors">Flujo Agéntico</a></li>
            <li><a href="#mcp" className="hover:text-white transition-colors">Conectores MCP</a></li>
            <li><a href="#arquitectura" className="hover:text-white transition-colors">Arquitectura Local-First</a></li>
            <li><a href="#skills" className="hover:text-white transition-colors">Skills & Herramientas</a></li>
            <li><a href="#descargas" className="hover:text-white transition-colors">Descargas Oficiales</a></li>
          </ul>
        </div>

        {/* Col 3: Recursos */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-4">Recursos</h4>
          <ul className="space-y-2.5 text-sm text-gray-400">
            <li>
              <button
                onClick={onOpenDocs}
                className="hover:text-amber-300 text-left transition-colors flex items-center gap-1.5"
              >
                <span>Documentación (Docs)</span>
                <BookOpen className="w-3.5 h-3.5 text-amber-300" />
              </button>
            </li>
            <li><a href="https://github.com/Naiker12/Sparta-Agent" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Código en GitHub</a></li>
            <li><a href="https://github.com/Naiker12/Sparta-Agent/releases" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Registro de Versiones</a></li>
            <li><a href="#faq" className="hover:text-white transition-colors">Preguntas Frecuentes</a></li>
            <li><a href="#arquitectura" className="hover:text-white transition-colors">Matriz de Seguridad</a></li>
          </ul>
        </div>

        {/* Col 4: Comunidad */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-4">Comunidad</h4>
          <ul className="space-y-2.5 text-sm text-gray-400">
            <li><a href="https://github.com/Naiker12/Sparta-Agent/issues" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Reportar un Bug</a></li>
            <li><a href="https://github.com/Naiker12/Sparta-Agent/discussions" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discusiones</a></li>
            <li><a href="https://github.com/Naiker12/Sparta-Agent" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contribuir</a></li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto border-t border-white/5 pt-8 flex flex-col md:flex-row justify-center items-center gap-4 text-xs text-gray-500 text-center">
        <span>© 2026 Sparta Agent. Todos los derechos reservados</span>
        <span className="hidden md:inline">•</span>
        <span>Impulsado por <span className="text-gray-300 font-semibold">LangGraph, Rust & Electron</span></span>
        <span className="hidden md:inline">•</span>
        <span>Código Abierto para la Comunidad</span>
      </div>
    </footer>
  )
}

// ── Main Landing & Docs Router Component ─────────────────────────────────────
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
    <div className="min-h-screen bg-black text-white selection:bg-amber-400/20 selection:text-amber-200 font-sans antialiased overflow-x-hidden">
      <Navbar onOpenDocs={openDocs} />
      <main>
        <HeroSection />
        <ProductTour />
        <SkillsShowcase />
        <DownloadSection />
        <FaqSection />
      </main>
      <FooterSection onOpenDocs={openDocs} />
      <ReleaseModal />
    </div>
  )
}
