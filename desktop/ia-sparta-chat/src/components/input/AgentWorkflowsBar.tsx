import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useSettingsStore, useSessionStore } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import {
  SvglReact,
  SvglNextjs,
  SvglTypeScript,
  SvglTailwind,
  SvglPython,
  SvglNodejs,
  SvglDocker,
  SvglGit,
  SvglVitest,
  SvglPlaywright,
  SvglJest,
  SvglVite,
  SvglPostgres,
  SvglGoogle,
  SvglGithub,
  SvglSparta,
  SvglBug,
  SvglPerformance,
  SvglCleanCode,
  SvglBenchmark,
  SvglDocs,
  SvglTerminal,
  SvglMcp,
  SvglApiTest,
  SvglSparkleAi,
  SvglScanCode,
  SvglRefactor,
  SvglTestTube,
  SvglDeepSearch,
} from './SvglIcons'

interface WorkflowSubOption {
  id: string
  label: { es: string; en: string }
  prompt: { es: string; en: string }
  badge?: { es: string; en: string }
  icon: React.ComponentType<{ size?: number; className?: string }>
}

interface WorkflowCategory {
  id: string
  labelKey: string
  defaultLabel: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
  options: WorkflowSubOption[]
}

const WORKFLOW_CATEGORIES: WorkflowCategory[] = [
  {
    id: 'create',
    labelKey: 'chat.workflows.createWithAi',
    defaultLabel: 'Crear con IA',
    icon: SvglSparkleAi,
    color: '#8b5cf6',
    options: [
      {
        id: 'create-react',
        label: { es: 'Componente React / UI', en: 'React UI Component' },
        prompt: {
          es: 'Crea un componente UI en React y TypeScript con diseño moderno, animaciones fluidas y accesibilidad completa para ',
          en: 'Create a modern React and TypeScript UI component with fluid animations and full accessibility for '
        },
        badge: { es: 'React', en: 'React' },
        icon: SvglReact,
      },
      {
        id: 'create-nextjs',
        label: { es: 'App Next.js Fullstack', en: 'Next.js Fullstack App' },
        prompt: {
          es: 'Diseña una aplicación web con Next.js App Router, Server Actions, estado global y estilos pulidos para ',
          en: 'Design a web app with Next.js App Router, Server Actions, global state, and polished styles for '
        },
        badge: { es: 'Next.js', en: 'Next.js' },
        icon: SvglNextjs,
      },
      {
        id: 'create-tailwind',
        label: { es: 'Vista con Tailwind CSS', en: 'Tailwind CSS Layout' },
        prompt: {
          es: 'Diseña una interfaz moderna y responsiva usando Tailwind CSS con modo oscuro y micro-interacciones para ',
          en: 'Design a modern and responsive interface using Tailwind CSS with dark mode and micro-interactions for '
        },
        badge: { es: 'Tailwind', en: 'Tailwind' },
        icon: SvglTailwind,
      },
      {
        id: 'create-api-node',
        label: { es: 'API Backend Node / Express', en: 'Node/Express Backend API' },
        prompt: {
          es: 'Construye un servicio backend RESTful con Node.js, validación con Zod, middleware de errores y tipado fuerte para ',
          en: 'Build a RESTful backend service with Node.js, Zod validation, error middleware, and strong typing for '
        },
        badge: { es: 'Node.js', en: 'Node.js' },
        icon: SvglNodejs,
      },
      {
        id: 'create-python-api',
        label: { es: 'Microservicio Python / FastAPI', en: 'Python / FastAPI Microservice' },
        prompt: {
          es: 'Escribe un microservicio en Python usando FastAPI, modelos Pydantic y manejo de concurrencia para ',
          en: 'Write a Python microservice using FastAPI, Pydantic models, and concurrency handling for '
        },
        badge: { es: 'Python', en: 'Python' },
        icon: SvglPython,
      },
      {
        id: 'create-vite',
        label: { es: 'Proyecto Rápido con Vite', en: 'Vite Fast Project Setup' },
        prompt: {
          es: 'Inicializa una estructura de proyecto moderna y ultra rápida con Vite, TypeScript y configuración optimizada para ',
          en: 'Initialize a fast and modern project structure with Vite, TypeScript, and optimized configuration for '
        },
        badge: { es: 'Vite', en: 'Vite' },
        icon: SvglVite,
      }
    ]
  },
  {
    id: 'analyze',
    labelKey: 'chat.workflows.analyzeCode',
    defaultLabel: 'Analizar',
    icon: SvglScanCode,
    color: '#3b82f6',
    options: [
      {
        id: 'analyze-bugs',
        label: { es: 'Auditoría de Bugs y Errores', en: 'Bug & Error Audit' },
        prompt: {
          es: 'Analiza el código en busca de posibles bugs, condiciones de carrera, fugas de memoria o errores de lógica en ',
          en: 'Analyze code for potential bugs, race conditions, memory leaks, or logical errors in '
        },
        badge: { es: 'Bugs', en: 'Bugs' },
        icon: SvglBug,
      },
      {
        id: 'analyze-perf',
        label: { es: 'Rendimiento y Bottlenecks', en: 'Performance & Bottlenecks' },
        prompt: {
          es: 'Revisa el rendimiento del código e identifica cuellos de botella computacionales o re-renders innecesarios en ',
          en: 'Review code performance and identify computational bottlenecks or unnecessary re-renders in '
        },
        badge: { es: 'Perf', en: 'Perf' },
        icon: SvglPerformance,
      },
      {
        id: 'analyze-docker',
        label: { es: 'Diagnóstico Docker / DevOps', en: 'Docker & DevOps Diagnosis' },
        prompt: {
          es: 'Analiza la configuración de Dockerfile, Docker Compose y optimización de capas de construcción para ',
          en: 'Analyze Dockerfile configuration, Docker Compose, and build layer optimization for '
        },
        badge: { es: 'Docker', en: 'Docker' },
        icon: SvglDocker,
      },
      {
        id: 'analyze-db',
        label: { es: 'Consultas y Esquema SQL', en: 'SQL Schema & Queries' },
        prompt: {
          es: 'Audita las consultas de base de datos, índices, normalización y rendimiento SQL en ',
          en: 'Audit database queries, indexes, normalization, and SQL performance in '
        },
        badge: { es: 'PostgreSQL', en: 'PostgreSQL' },
        icon: SvglPostgres,
      }
    ]
  },
  {
    id: 'refactor',
    labelKey: 'chat.workflows.refactorCode',
    defaultLabel: 'Refactorizar',
    icon: SvglRefactor,
    color: '#10b981',
    options: [
      {
        id: 'refactor-ts',
        label: { es: 'Fortalecer Tipado TypeScript', en: 'Strict TypeScript Typing' },
        prompt: {
          es: 'Reemplaza tipos débiles (any/unknown) con interfaces estrictas, generics seguros y tipos exhaustivos en ',
          en: 'Replace weak types (any/unknown) with strict interfaces, safe generics, and exhaustive types in '
        },
        badge: { es: 'TypeScript', en: 'TypeScript' },
        icon: SvglTypeScript,
      },
      {
        id: 'refactor-clean',
        label: { es: 'Limpieza y Modularización (SOLID)', en: 'Clean Code & SOLID Modularity' },
        prompt: {
          es: 'Refactoriza este código aplicando principios SOLID, código limpio y mejor legibilidad sin romper compatibilidad para ',
          en: 'Refactor this code applying SOLID principles, clean code, and higher readability without breaking compatibility for '
        },
        badge: { es: 'Clean Code', en: 'Clean Code' },
        icon: SvglCleanCode,
      },
      {
        id: 'refactor-git',
        label: { es: 'Organizar Commits y Cambios', en: 'Organize Commits & Diffs' },
        prompt: {
          es: 'Prepara un desglose limpio de cambios para git con mensajes convencionales (Conventional Commits) para ',
          en: 'Prepare a clean git changeset breakdown with Conventional Commits messages for '
        },
        badge: { es: 'Git', en: 'Git' },
        icon: SvglGit,
      },
      {
        id: 'refactor-python',
        label: { es: 'Pythonic Refactor & Typing', en: 'Pythonic Refactor & Typing' },
        prompt: {
          es: 'Refactoriza este código Python siguiendo PEP 8, Type Hints modernos y estructuras eficientes para ',
          en: 'Refactor this Python code following PEP 8, modern Type Hints, and efficient structures for '
        },
        badge: { es: 'Python', en: 'Python' },
        icon: SvglPython,
      }
    ]
  },
  {
    id: 'tests',
    labelKey: 'chat.workflows.generateTests',
    defaultLabel: 'Generar Tests',
    icon: SvglTestTube,
    color: '#ec4899',
    options: [
      {
        id: 'tests-vitest',
        label: { es: 'Tests Unitarios con Vitest', en: 'Unit Tests with Vitest' },
        prompt: {
          es: 'Genera una suite exhaustiva de pruebas unitarias con mocks adecuados y casos límite usando Vitest para ',
          en: 'Generate a comprehensive unit test suite with appropriate mocks and edge cases using Vitest for '
        },
        badge: { es: 'Vitest', en: 'Vitest' },
        icon: SvglVitest,
      },
      {
        id: 'tests-playwright',
        label: { es: 'Tests E2E con Playwright', en: 'E2E Tests with Playwright' },
        prompt: {
          es: 'Escribe pruebas de integración y flujos completos de usuario (E2E) con Playwright para ',
          en: 'Write integration tests and end-to-end user flows with Playwright for '
        },
        badge: { es: 'Playwright', en: 'Playwright' },
        icon: SvglPlaywright,
      },
      {
        id: 'tests-jest',
        label: { es: 'Tests de Regresión con Jest', en: 'Regression Tests with Jest' },
        prompt: {
          es: 'Configura y escribe pruebas de regresión y snapshots con Jest para ',
          en: 'Configure and write regression tests and snapshots with Jest for '
        },
        badge: { es: 'Jest', en: 'Jest' },
        icon: SvglJest,
      },
      {
        id: 'tests-api',
        label: { es: 'Tests de Integración de API', en: 'API Integration Tests' },
        prompt: {
          es: 'Crea pruebas de integración para validar endpoints HTTP, códigos de estado y respuestas JSON en ',
          en: 'Create integration tests to validate HTTP endpoints, status codes, and JSON responses in '
        },
        badge: { es: 'API QA', en: 'API QA' },
        icon: SvglApiTest,
      }
    ]
  },
  {
    id: 'search',
    labelKey: 'chat.workflows.deepSearch',
    defaultLabel: 'Investigar',
    icon: SvglDeepSearch,
    color: '#10b981',
    options: [
      {
        id: 'search-google',
        label: { es: 'Investigación Web Profunda', en: 'Deep Web Search' },
        prompt: {
          es: 'Busca e investiga en la web las mejores librerías, documentación oficial y arquitecturas recomendadas para ',
          en: 'Search and research official documentation, recommended libraries, and modern architectures for '
        },
        badge: { es: 'Google', en: 'Google' },
        icon: SvglGoogle,
      },
      {
        id: 'search-github',
        label: { es: 'Repositorios y Código GitHub', en: 'GitHub Repos & Code' },
        prompt: {
          es: 'Investiga ejemplos de código abierto en GitHub, patrones de diseño y estándares comunitarios para ',
          en: 'Research open source GitHub examples, design patterns, and community standards for '
        },
        badge: { es: 'GitHub', en: 'GitHub' },
        icon: SvglGithub,
      },
      {
        id: 'search-compare',
        label: { es: 'Comparativa de Tecnologías', en: 'Tech Comparison Benchmark' },
        prompt: {
          es: 'Haz un análisis comparativo detallado de pros, contras, rendimiento y madurez de soluciones para ',
          en: 'Perform a detailed comparative analysis of pros, cons, performance, and ecosystem maturity for '
        },
        badge: { es: 'Benchmark', en: 'Benchmark' },
        icon: SvglBenchmark,
      },
      {
        id: 'search-docs',
        label: { es: 'Documentación Oficial y RFCs', en: 'Official Docs & RFCs' },
        prompt: {
          es: 'Extrae y resume las especificaciones oficiales, estándares técnicos y RFCs relevantes para ',
          en: 'Extract and summarize official specifications, technical standards, and relevant RFCs for '
        },
        badge: { es: 'Docs', en: 'Docs' },
        icon: SvglDocs,
      }
    ]
  },
  {
    id: 'agent',
    labelKey: 'chat.workflows.startAgent',
    defaultLabel: 'Agente Sparta',
    icon: SvglSparta,
    color: '#d97706',
    options: [
      {
        id: 'agent-full',
        label: { es: 'Planificar y Ejecutar Proyecto', en: 'Plan & Execute Project' },
        prompt: {
          es: 'Actúa como Sparta Agent en modo autónomo: investiga el workspace, crea un plan de implementación detallado y ejecuta los cambios para ',
          en: 'Act as autonomous Sparta Agent: inspect workspace, create a detailed implementation plan, and execute changes for '
        },
        badge: { es: 'Sparta', en: 'Sparta' },
        icon: SvglSparta,
      },
      {
        id: 'agent-terminal',
        label: { es: 'Comandos de Terminal y CLI', en: 'Terminal & CLI Commands' },
        prompt: {
          es: 'Utiliza la consola y herramientas del sistema para compilar, auditar o ejecutar el entorno de ',
          en: 'Use the terminal and system tools to build, audit, or execute the environment for '
        },
        badge: { es: 'Terminal', en: 'Terminal' },
        icon: SvglTerminal,
      },
      {
        id: 'agent-mcp',
        label: { es: 'Conectores MCP e Integraciones', en: 'MCP Connectors & Integrations' },
        prompt: {
          es: 'Aprovecha las herramientas y recursos MCP conectados para automatizar el flujo de trabajo de ',
          en: 'Leverage connected MCP tools and resources to automate the workflow for '
        },
        badge: { es: 'MCP', en: 'MCP' },
        icon: SvglMcp,
      }
    ]
  }
]

interface AgentWorkflowsBarProps {
  onSelectWorkflow?: (promptText: string) => void
  compact?: boolean
}

export function AgentWorkflowsBar({ onSelectWorkflow }: AgentWorkflowsBarProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const { setInput, setSessionMode: setDefaultSessionMode } = useSettingsStore()
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const updateSessionMeta = useSessionStore((s) => s.updateSessionMeta)
  const { t, lang } = useTranslation()

  const currentLang = (lang === 'en' ? 'en' : 'es') as 'es' | 'en'

  const handleSelectOption = (option: WorkflowSubOption) => {
    const text = option.prompt[currentLang] || option.prompt.es

    // 1. Activar automáticamente el Modo Agente
    if (activeSessionId) {
      updateSessionMeta(activeSessionId, { sessionMode: 'agent' })
    } else {
      setDefaultSessionMode('agent')
    }

    // 2. Insertar el prompt en el compose
    if (onSelectWorkflow) {
      onSelectWorkflow(text)
    } else {
      setInput(text)
    }

    // 3. Cerrar el panel
    setActiveCategory(null)
  }

  const selectedCategory = WORKFLOW_CATEGORIES.find((c) => c.id === activeCategory)

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Barra superior de pestañas de flujos centrada con iconos SVGL */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {WORKFLOW_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id
          const translatedLabel = t(cat.labelKey) !== cat.labelKey ? t(cat.labelKey) : cat.defaultLabel
          const CategoryIcon = cat.icon

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(isActive ? null : cat.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 13px',
                background: isActive
                  ? `color-mix(in srgb, ${cat.color} 14%, var(--bg-surface))`
                  : 'var(--bg-surface)',
                border: `1px solid ${isActive ? cat.color : 'var(--border-subtle)'}`,
                borderRadius: 999,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? `0 2px 8px color-mix(in srgb, ${cat.color} 20%, transparent)` : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = cat.color
                  e.currentTarget.style.color = 'var(--text-primary)'
                  e.currentTarget.style.background = `color-mix(in srgb, ${cat.color} 6%, var(--bg-surface))`
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                  e.currentTarget.style.background = 'var(--bg-surface)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              <CategoryIcon size={14} />
              <span>{translatedLabel}</span>
            </button>
          )
        })}
      </div>

      {/* Sub-panel expandible con iconos SVGL exactos por cada tecnología */}
      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              overflow: 'hidden',
              background: 'var(--bg-surface)',
              border: `1px solid color-mix(in srgb, ${selectedCategory.color} 30%, var(--border-subtle))`,
              borderRadius: 12,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <selectedCategory.icon size={15} />
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {t('chat.workflows.chooseWorkflow') || 'Elige un flujo de trabajo para el agente:'}
                </span>
              </div>
              <button
                onClick={() => setActiveCategory(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <X size={13} />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 6,
              }}
            >
              {selectedCategory.options.map((opt) => {
                const label = opt.label[currentLang] || opt.label.es
                const badge = opt.badge ? opt.badge[currentLang] || opt.badge.es : null
                const OptionIcon = opt.icon

                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(opt)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 11px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = selectedCategory.color
                      e.currentTarget.style.color = 'var(--text-primary)'
                      e.currentTarget.style.background = `color-mix(in srgb, ${selectedCategory.color} 8%, var(--bg-input))`
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                      e.currentTarget.style.background = 'var(--bg-input)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <OptionIcon size={15} />
                      <span>{label}</span>
                    </span>
                    {badge && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: `color-mix(in srgb, ${selectedCategory.color} 15%, transparent)`,
                          color: selectedCategory.color,
                          fontWeight: 600,
                        }}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
