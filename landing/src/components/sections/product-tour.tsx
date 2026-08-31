import React, { useState, useEffect } from 'react'
import {
  Bot,
  Code2,
  FileText,
  Network,
  ShieldCheck,
  TerminalSquare,
  Terminal,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Badge } from '../ui/badge'
import { getPublicUrl } from '../../lib/utils'

type Capability = {
  id: string
  icon: typeof Bot
  eyebrow: string
  title: string
  description: string
  details: string[]
  image?: { src: string; alt: string }
  video?: { src: string; label: string }
  imageLabel: string
}

const capabilities: Capability[] = [
  {
    id: 'flujo-agentico',
    icon: Bot,
    eyebrow: '01 · ORQUESTACIÓN',
    title: 'Conversaciones que se convierten en planes de trabajo',
    description:
      'Explica el objetivo en lenguaje natural y revisa un plan por etapas antes de que el agente ejecute cualquier cambio en el repositorio.',
    details: ['Plan visible por etapas', 'Seguimiento de sesión', 'Contexto del workspace'],
    video: {
      src: getPublicUrl('proyecto/Conversaciones que se convierten.mp4'),
      label: 'Demostración del flujo de planificación',
    },
    imageLabel: 'Demostración del flujo de planificación',
  },
  {
    id: 'archivos',
    icon: FileText,
    eyebrow: '02 · CONTEXTO',
    title: 'Archivos, documentos y adjuntos en una misma sesión',
    description:
      'El flujo de trabajo unifica código, documentación y archivos adjuntos para que el agente opere con el contexto exacto de tu arquitectura.',
    details: ['Adjuntos multiformato', 'Indexación de documentos', 'Contexto local en memoria'],
    image: {
      src: getPublicUrl('proyecto/CONTEXTO.png'),
      alt: 'Contexto de archivos y documentos en Sparta Agent',
    },
    imageLabel: 'Contexto de archivos y documentos',
  },
  {
    id: 'arquitectura',
    icon: Code2,
    eyebrow: '03 · INGENIERÍA',
    title: 'Edición y revisión pensadas para el código',
    description:
      'Entorno de desarrollo agéntico basado en Electron, React y Monaco Editor para mantener la inspección y el diff visual cerca de la conversación.',
    details: ['Editor Monaco', 'Diff de cambios en vivo', 'Inspección de AST'],
    video: {
      src: getPublicUrl('proyecto/Edición y revisión pensadas para el código.mp4'),
      label: 'Edición y revisión de código en Sparta Agent',
    },
    imageLabel: 'Edición y revisión de código en Sparta Agent',
  },
  {
    id: 'terminal',
    icon: TerminalSquare,
    eyebrow: '04 · EJECUCIÓN',
    title: 'Terminal integrada para comprobar el resultado',
    description:
      'Ejecuta comandos, suites de pruebas y migraciones desde el entorno de trabajo, manteniendo los logs y la salida asociados a la tarea.',
    details: ['Multi-shell nativa', 'Procesos en segundo plano', 'Auditoría en tiempo real'],
    imageLabel: 'Espacio para captura: terminal y validaciones',
  },
  {
    id: 'mcp',
    icon: Network,
    eyebrow: '05 · CONEXIONES',
    title: 'Herramientas y servicios conectados mediante MCP',
    description:
      'Amplía el agente con servidores Model Context Protocol para conectar bases de datos, APIs, Notion, Slack, Google Drive y sistemas de archivos.',
    details: ['Protocolo MCP abierto', 'Canal IPC seguro', 'Catálogo de conectores'],
    video: {
      src: getPublicUrl('proyecto/Herramientas y servicios conectados mediante MCP.mp4'),
      label: 'Conexiones MCP en Sparta Agent',
    },
    imageLabel: 'Conexiones MCP en Sparta Agent',
  },
  {
    id: 'seguridad',
    icon: ShieldCheck,
    eyebrow: '06 · CONTROL',
    title: 'Permisos explícitos antes de acciones sensibles',
    description:
      'El Permission Broker intercepta escrituras en disco, borrado de archivos y llamadas a APIs para que el usuario mantenga el control total.',
    details: ['Modal de confirmación', 'Políticas por herramienta', 'Zero cloud leaks'],
    image: {
      src: getPublicUrl('proyecto/Permisos antes de las acciones sensibles.png'),
      alt: 'Permisos y controles de Sparta Agent',
    },
    imageLabel: 'Permisos y controles de Sparta Agent',
  },
]

interface TerminalScript {
  command: string
  lines: { text: string; color: string }[]
}

const TERMINAL_SCRIPTS: TerminalScript[] = [
  {
    command: 'sparta test --suite=integration --workers=4',
    lines: [
      { text: '[00:01] 🔍 Indexando grafo AST de 48 archivos locales...', color: 'text-[#6a6b6c]' },
      { text: '[00:02] ✓ 18 tests de integración completados (38ms)', color: 'text-[#59d499]' },
      { text: '[00:02] ✓ LangGraph State Machine benchmark: 0 memory leaks', color: 'text-[#59d499]' },
      { text: '[00:03] 🛡️ Sandbox Broker: Canal IPC seguro · Cero telemetría externa', color: 'text-[#63a1ff]' },
    ],
  },
  {
    command: 'sparta mcp:call --server=filesystem --action=read_dir',
    lines: [
      { text: '[00:01] 🔒 PermissionBroker: Autorización verificada para ~/workspace', color: 'text-[#fbbf24]' },
      { text: '[00:01] ✓ Conectado a socket IPC local (fd=12)', color: 'text-[#59d499]' },
      { text: '[00:02] 📁 14 archivos indexados en SQLite en memoria', color: 'text-[#63a1ff]' },
      { text: '[00:02] → Vault de secretos AES-256 activo y custodiado', color: 'text-[#6a6b6c]' },
    ],
  },
  {
    command: 'sparta build --target=sidecar-rust --release',
    lines: [
      { text: '[00:01] ⚡ Compilando sparta-core v0.2.13 (Tokio runtime + C-ABI)...', color: 'text-[#6a6b6c]' },
      { text: '[00:02] ✓ Target release [optimizado] finalizado en 1.24s', color: 'text-[#59d499]' },
      { text: '[00:03] 📦 Binario nativo generado: /dist/sparta-sidecar.exe', color: 'text-[#ff6363]' },
    ],
  },
]

// ── Interactive Animated Terminal Simulator ──────────────────────────────────
function AnimatedTerminalMockup() {
  const [scriptIndex, setScriptIndex] = useState(0)
  const [displayedCommand, setDisplayedCommand] = useState('')
  const [visibleLinesCount, setVisibleLinesCount] = useState(0)
  const [isTyping, setIsTyping] = useState(true)

  const currentScript = TERMINAL_SCRIPTS[scriptIndex]

  useEffect(() => {
    let timeout: NodeJS.Timeout
    let charIndex = 0
    setDisplayedCommand('')
    setVisibleLinesCount(0)
    setIsTyping(true)

    // Typewriter effect for command
    const typeInterval = setInterval(() => {
      if (charIndex < currentScript.command.length) {
        setDisplayedCommand(currentScript.command.slice(0, charIndex + 1))
        charIndex++
      } else {
        clearInterval(typeInterval)
        setIsTyping(false)

        // Reveal output lines progressively
        let lineIdx = 0
        const lineInterval = setInterval(() => {
          if (lineIdx < currentScript.lines.length) {
            setVisibleLinesCount(lineIdx + 1)
            lineIdx++
          } else {
            clearInterval(lineInterval)
            // Pause before switching to next script
            timeout = setTimeout(() => {
              setScriptIndex((prev) => (prev + 1) % TERMINAL_SCRIPTS.length)
            }, 3200)
          }
        }, 350)
      }
    }, 45)

    return () => {
      clearInterval(typeInterval)
      clearTimeout(timeout)
    }
  }, [scriptIndex])

  return (
    <div className="relative isolate min-h-[320px] sm:min-h-[360px] overflow-hidden rounded-[16px] border border-[#363739] bg-[#07080a] p-5 sm:p-6 shadow-key flex flex-col justify-between select-none">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between border-b border-[#363739] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#ff6363]" />
            <span className="size-2.5 rounded-full bg-[#fbbf24]" />
            <span className="size-2.5 rounded-full bg-[#59d499]" />
            <span className="ml-2 font-mono text-[11px] text-[#6a6b6c]">
              sparta-terminal // zsh · pid: 4821
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#59d499] opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-[#59d499]" />
            </span>
            <span className="font-mono text-[10px] uppercase text-[#59d499] bg-[#0b2014] border border-[#59d499]/30 px-2 py-0.5 rounded-[6px]">
              LIVE IPC BRIDGE
            </span>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="space-y-3 font-mono text-xs text-[#9c9c9d] leading-relaxed">
          {/* Active Command Line */}
          <div className="flex items-center gap-2 text-white">
            <span className="text-[#ff6363] font-bold">$</span>
            <span>{displayedCommand}</span>
            {isTyping && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="inline-block w-2 h-4 bg-white align-middle"
              />
            )}
          </div>

          {/* Sequential Output Lines */}
          <div className="space-y-1.5 pt-1">
            {currentScript.lines.slice(0, visibleLinesCount).map((line, idx) => (
              <motion.p
                key={idx}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={line.color}
              >
                {line.text}
              </motion.p>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between border-t border-[#363739] pt-3 mt-4 text-[10px] font-mono text-[#6a6b6c]">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-[#9c9c9d]" />
          <span>Local Engine · Latency: 0.4ms</span>
        </div>
        <span className="text-[#9c9c9d]">UTF-8 · Interactive Multi-Shell</span>
      </div>
    </div>
  )
}

function ImageSlot({ capability }: { capability: Capability }) {
  if (capability.video) {
    return (
      <div className="relative overflow-hidden rounded-[16px] border border-[#363739] bg-[#07080a] shadow-key">
        <video
          className="block w-full object-contain"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        >
          <source src={capability.video.src} type="video/mp4" />
        </video>
      </div>
    )
  }

  if (capability.image) {
    return (
      <div className="relative overflow-hidden rounded-[16px] border border-[#363739] bg-[#07080a] shadow-key">
        <img
          className="block w-full object-contain transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.015]"
          src={capability.image.src}
          alt={capability.image.alt}
          loading="lazy"
        />
      </div>
    )
  }

  return <AnimatedTerminalMockup />
}

export function ProductTour() {
  const reduceMotion = useReducedMotion()

  return (
    <div id="producto" className="border-t border-[#363739] bg-[#040506] py-16 md:py-24">
      {/* Section Header */}
      <div className="mx-auto max-w-7xl px-6 text-center mb-16 md:mb-24">
        <div className="mx-auto max-w-3xl space-y-4">
          <Badge variant="default" className="text-[#9c9c9d]">
            CAPACIDADES DEL IDE
          </Badge>
          <h2 className="text-3xl font-medium tracking-tight text-white md:text-5xl">
            Un espacio de trabajo para pasar de intención a resultado.
          </h2>
          <p className="text-base leading-relaxed text-[#9c9c9d] md:text-lg">
            Capacidades diseñadas en torno al flujo de desarrollo: entender la arquitectura, operar
            sobre el código, validar cambios y conservar el control estricto de permisos.
          </p>
        </div>
      </div>

      {/* Capabilities List */}
      <div className="space-y-16 md:space-y-24 max-w-7xl mx-auto px-6">
        {capabilities.map((capability, index) => {
          const Icon = capability.icon
          const isEven = index % 2 === 0

          return (
            <motion.section
              id={capability.id}
              key={capability.id}
              className="rounded-[20px] border border-[#363739] bg-[#07080a] p-6 md:p-10 shadow-key transition-all duration-300 hover:border-white/20"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className={`grid items-center gap-8 lg:gap-12 ${
                  isEven ? 'lg:grid-cols-[1.1fr_0.9fr]' : 'lg:grid-cols-[0.9fr_1.1fr]'
                }`}
              >
                {/* Media Slot */}
                <div className={isEven ? 'group lg:order-1' : 'group lg:order-2'}>
                  <ImageSlot capability={capability} />
                </div>

                {/* Content Details */}
                <div className={isEven ? 'lg:order-2 space-y-4' : 'lg:order-1 space-y-4'}>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full border border-[#363739] bg-[#111214] shadow-key">
                      <Icon className="size-4 text-[#e6e6e6]" />
                    </div>
                    <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#6a6b6c]">
                      {capability.eyebrow}
                    </span>
                  </div>

                  <h3 className="text-2xl font-medium tracking-tight text-white md:text-3xl">
                    {capability.title}
                  </h3>

                  <p className="text-base leading-relaxed text-[#9c9c9d]">
                    {capability.description}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {capability.details.map((detail) => (
                      <span
                        key={detail}
                        className="rounded-[6px] border border-[#363739] bg-[#111214] px-2.5 py-1 font-mono text-[11px] text-[#9c9c9d]"
                      >
                        {detail}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          )
        })}
      </div>
    </div>
  )
}
