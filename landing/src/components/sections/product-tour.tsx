import {
  Bot,
  Code2,
  FileText,
  Network,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
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
      'Explica el objetivo en lenguaje natural y revisa un plan antes de que el agente avance con una tarea compleja.',
    details: ['Plan visible por etapas', 'Seguimiento de la sesión', 'Contexto del workspace'],
    video: { src: getPublicUrl('proyecto/Conversaciones que se convierten.mp4'), label: 'Demostración del flujo de planificación' },
    imageLabel: 'Demostración del flujo de planificación',
  },
  {
    id: 'archivos',
    icon: FileText,
    eyebrow: '02 · CONTEXTO',
    title: 'Archivos, documentos y adjuntos en una misma sesión',
    description:
      'El flujo de trabajo reúne código y adjuntos para que el agente pueda trabajar con el contexto que le das.',
    details: ['Adjuntos de archivos', 'Contenido de documentos', 'Área reservada para una captura real'],
    image: { src: getPublicUrl('proyecto/CONTEXTO.png'), alt: 'Contexto de archivos y documentos en Sparta Agent' },
    imageLabel: 'Contexto de archivos y documentos',
  },
  {
    id: 'arquitectura',
    icon: Code2,
    eyebrow: '03 · INGENIERÍA',
    title: 'Edición y revisión pensadas para el código',
    description:
      'La aplicación integra un entorno de desarrollo basado en Electron, React y Monaco para mantener la revisión cerca de la conversación.',
    details: ['Editor Monaco', 'Revisión de cambios', 'Área reservada para captura de diff'],
    video: { src: getPublicUrl('proyecto/Edición y revisión pensadas para el código.mp4'), label: 'Edición y revisión de código en Sparta Agent' },
    imageLabel: 'Edición y revisión de código en Sparta Agent',
  },
  {
    id: 'terminal',
    icon: TerminalSquare,
    eyebrow: '04 · EJECUCIÓN',
    title: 'Terminal integrada para comprobar el resultado',
    description:
      'Ejecuta comandos y validaciones desde el entorno de trabajo, manteniendo la salida asociada a la tarea.',
    details: ['Sesiones de terminal', 'Ejecución de comandos', 'Espacio para captura de terminal'],
    imageLabel: 'Espacio para captura: terminal y validaciones',
  },
  {
    id: 'mcp',
    icon: Network,
    eyebrow: '05 · CONEXIONES',
    title: 'Herramientas y servicios conectados mediante MCP',
    description:
      'Amplía el agente con servidores Model Context Protocol para conectar herramientas, datos y servicios externos.',
    details: ['Catálogo de integraciones', 'Conectores configurables', 'Herramientas conectadas mediante MCP'],
    video: { src: getPublicUrl('proyecto/Herramientas y servicios conectados mediante MCP.mp4'), label: 'Conexiones MCP en Sparta Agent' },
    imageLabel: 'Conexiones MCP en Sparta Agent',
  },
  {
    id: 'seguridad',
    icon: ShieldCheck,
    eyebrow: '06 · CONTROL',
    title: 'Permisos antes de las acciones sensibles',
    description:
      'El producto incorpora controles de permisos para herramientas como terminal, código y MCP, para que el usuario conserve el control.',
    details: ['Confirmación de acciones', 'Restricciones por herramienta', 'Control antes de ejecutar'],
    image: { src: getPublicUrl('proyecto/Permisos antes de las acciones sensibles.png'), alt: 'Permisos y controles de Sparta Agent' },
    imageLabel: 'Permisos y controles de Sparta Agent',
  },
]

function ImageSlot({ capability }: { capability: Capability }) {
  if (capability.video) {
    return (
      <figure className="relative overflow-hidden bg-black shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        <video className="block w-full object-contain" autoPlay loop muted playsInline preload="metadata">
          <source src={capability.video.src} type="video/mp4" />
        </video>
      </figure>
    )
  }

  if (capability.image) {
    return (
      <figure className="relative overflow-hidden bg-black shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        <img className="block w-full object-contain transition-transform duration-1000 ease-out motion-safe:group-hover:scale-[1.018]" src={capability.image.src} alt={capability.image.alt} loading="lazy" />
      </figure>
    )
  }

  return (
    <div className="relative isolate aspect-[16/10] overflow-hidden bg-[#101014] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="absolute -left-[15%] top-[20%] size-[65%] rounded-full bg-amber-300/20 blur-3xl transition-transform duration-1000 motion-safe:group-hover:translate-x-5" />
      <div className="absolute -right-[10%] bottom-[5%] size-[55%] rounded-full bg-indigo-500/20 blur-3xl transition-transform duration-1000 motion-safe:group-hover:-translate-x-5" />
      <div className="absolute inset-[12%] border border-white/15" />
      <div className="absolute inset-x-[18%] top-[24%] h-[12%] bg-white/10" />
      <div className="absolute inset-x-[18%] top-[42%] h-[6%] bg-white/10" />
      <div className="absolute inset-x-[18%] top-[54%] h-[6%] w-[45%] bg-white/10" />
      <div className="absolute bottom-[19%] left-[18%] right-[18%] flex items-end gap-2">
        <span className="h-12 flex-1 bg-amber-200/80" />
        <span className="h-20 flex-1 bg-amber-200/50" />
        <span className="h-8 flex-1 bg-amber-200/35" />
        <span className="h-16 flex-1 bg-amber-200/65" />
        <span className="h-10 flex-1 bg-amber-200/45" />
      </div>
      <div className="absolute bottom-5 left-5 max-w-[18rem] bg-black/65 p-4 backdrop-blur-sm">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-100">Captura pendiente</p>
        <p className="mt-2 text-sm leading-relaxed text-gray-300">{capability.imageLabel}</p>
      </div>
    </div>
  )
}

export function ProductTour() {
  const reduceMotion = useReducedMotion()

  return (
    <div id="producto" className="border-y border-white/10 bg-[#08080a]">
      <div className="mx-auto max-w-7xl px-6 py-24 text-center md:py-32">
        <div className="mx-auto max-w-3xl">
          <Badge variant="outline" className="mb-5">PRODUCTO</Badge>
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">Un espacio de trabajo para pasar de intención a resultado.</h2>
          <p className="mt-6 text-base leading-relaxed text-gray-400 md:text-lg">
            Estas capacidades se organizan alrededor del flujo real de desarrollo: entender el trabajo, operar sobre el proyecto, validar y mantener el control.
          </p>
        </div>
      </div>

      {capabilities.map((capability, index) => {
            const Icon = capability.icon
            const imageFromLeft = index % 2 === 0
            return (
              <motion.section
                id={capability.id}
                key={capability.id}
                className={index % 2 === 0 ? 'border-t border-white/10 bg-black/20' : 'border-t border-white/10'}
                initial={reduceMotion ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45 }}
              >
                <div className={`mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:py-28 lg:gap-20 ${index % 2 === 0 ? 'lg:grid-cols-[1.2fr_0.8fr]' : 'lg:grid-cols-[0.8fr_1.2fr]'}`}>
                  <motion.div
                    className={index % 2 === 0 ? 'group lg:order-1' : 'group lg:order-2'}
                    initial={reduceMotion ? false : { opacity: 0, x: imageFromLeft ? -44 : 44, y: 16 }}
                    whileInView={{ opacity: 1, x: 0, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <ImageSlot capability={capability} />
                  </motion.div>
                  <motion.div
                    className={index % 2 === 0 ? 'lg:order-2' : 'lg:order-1'}
                    initial={reduceMotion ? false : { opacity: 0, x: imageFromLeft ? 36 : -36, y: 12 }}
                    whileInView={{ opacity: 1, x: 0, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.72, delay: reduceMotion ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div>
                      <div className="mb-5 flex items-center gap-4">
                        <div className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                          <Icon className="size-5 text-amber-200" />
                        </div>
                        <span className="text-[10px] font-mono tracking-[0.15em] text-gray-500">{capability.eyebrow}</span>
                      </div>
                      <h3 className="text-3xl font-bold leading-tight text-[#d8ecf8] md:text-4xl">{capability.title}</h3>
                      <p className="mt-5 max-w-xl text-base leading-relaxed text-[#9da7ba]">{capability.description}</p>
                      <ul className="mt-6 flex flex-wrap gap-2">
                        {capability.details.map((detail) => <li key={detail} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-400">{detail}</li>)}
                      </ul>
                    </div>
                  </motion.div>
                </div>
              </motion.section>
            )
          })}
    </div>
  )
}
