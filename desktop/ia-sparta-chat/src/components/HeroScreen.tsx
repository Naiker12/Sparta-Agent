import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RotateCw } from 'lucide-react'
import { useSettingsStore } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import {
  SvglReact,
  SvglNextjs,
  SvglTypeScript,
  SvglNodejs,
  SvglPython,
  SvglVitest,
  SvglPostgres,
  SvglSparta,
} from './input/SvglIcons'

const EXAMPLE_PROMPTS = [
  {
    es: 'Crea un componente UI en React y TypeScript con diseño moderno y animaciones',
    en: 'Build a modern React & TypeScript UI component with fluid animations',
    icon: SvglReact,
    badge: 'React',
    color: '#0284c7',
  },
  {
    es: '¿Cómo implemento autenticación JWT segura con cookies HTTP-only en Node.js?',
    en: 'How to implement secure JWT authentication with HTTP-only cookies in Node.js?',
    icon: SvglNodejs,
    badge: 'Node.js',
    color: '#16a34a',
  },
  {
    es: 'Explícame las diferencias entre arquitecturas REST y GraphQL en Next.js',
    en: 'Explain differences between REST and GraphQL architectures in Next.js',
    icon: SvglNextjs,
    badge: 'Next.js',
    color: '#18181b',
  },
  {
    es: 'Refactoriza este código aplicando principios SOLID y TypeScript estricto',
    en: 'Refactor this code applying SOLID principles and strict TypeScript typing',
    icon: SvglTypeScript,
    badge: 'TypeScript',
    color: '#2563eb',
  },
  {
    es: 'Escribe una suite exhaustiva de tests unitarios con Vitest y mocks de APIs',
    en: 'Write a comprehensive unit test suite with Vitest and API mocks',
    icon: SvglVitest,
    badge: 'Vitest',
    color: '#65a30d',
  },
  {
    es: 'Escribe un microservicio en Python usando FastAPI y validación con Pydantic',
    en: 'Write a Python microservice using FastAPI and Pydantic models validation',
    icon: SvglPython,
    badge: 'Python',
    color: '#d97706',
  },
  {
    es: 'Audita y optimiza consultas complejas, índices y esquema en PostgreSQL',
    en: 'Audit and optimize complex queries, indexes and schema in PostgreSQL',
    icon: SvglPostgres,
    badge: 'Postgres',
    color: '#0284c7',
  },
  {
    es: 'Actúa como Sparta Agent autónomo: investiga el workspace y ejecuta los cambios',
    en: 'Act as autonomous Sparta Agent: inspect workspace and execute code changes',
    icon: SvglSparta,
    badge: 'Sparta Agent',
    color: '#b45309',
  },
]

export function HeroScreen() {
  const { setInput } = useSettingsStore()
  const { t, lang } = useTranslation()
  const [prompts, setPrompts] = useState<typeof EXAMPLE_PROMPTS>([])

  const shufflePrompts = () => {
    const shuffled = [...EXAMPLE_PROMPTS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
    setPrompts(shuffled)
  }

  useEffect(() => {
    shufflePrompts()
  }, [])

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '0 24px',
        userSelect: 'none',
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
      }}
    >
      {/* Animated Brand Icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 10 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: [0, -6, 0],
        }}
        transition={{
          opacity: { duration: 0.5 },
          scale: { duration: 0.5 },
          y: {
            repeat: Infinity,
            duration: 4,
            ease: 'easeInOut',
            delay: 0.5,
          },
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 180,
          height: 110,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Glow de acento de marca */}
        <div
          style={{
            position: 'absolute',
            width: 130,
            height: 130,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <img
          src="./sparta-icon.png"
          alt="Sparta"
          style={{
            position: 'absolute',
            top: -24,
            width: 180,
            height: 180,
            objectFit: 'contain',
            filter: 'var(--invert-logo)',
          }}
        />
      </motion.div>

      {/* Hero Title & Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        style={{ textAlign: 'center' }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display, var(--font-ui))',
            fontSize: 'clamp(28px, 4.5vw, 36px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text-display, #1C1713)',
            lineHeight: 1.25,
            marginBottom: 6,
          }}
        >
          {t('chat.heroTitle') || 'Chat con Sparta Agent'}
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: 'var(--text-muted, #786C5E)',
            textAlign: 'center',
            maxWidth: 500,
            lineHeight: 1.5,
            fontWeight: 400,
            margin: 0,
          }}
        >
          {t('chat.welcome') || 'Describe tu tarea. Elegiré las herramientas, explicaré el plan y confirmaré antes de acciones riesgosas.'}
        </p>
      </motion.div>

      {/* Prompt Suggestions Grid with Authentic SVGL Technology Vectors */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{
          width: '100%',
          maxWidth: 560,
          marginTop: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} color="#B45309" />
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted, #8A7D6F)',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {t('chat.tryWith') || 'PRUEBA CON'}
            </span>
          </div>
          <button
            onClick={shufflePrompts}
            title={t('chat.suggestions') || 'Nuevas sugerencias'}
            style={{
              background: 'none',
              border: 'none',
              color: '#8A7D6F',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              borderRadius: '50%',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#B45309'
              e.currentTarget.style.backgroundColor = '#F5EFE6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#8A7D6F'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <RotateCw size={13} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
          }}
        >
          {prompts.map((prompt, idx) => {
            const Icon = prompt.icon
            return (
              <motion.button
                key={prompt.es}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + idx * 0.06, duration: 0.25, ease: 'easeOut' }}
                onClick={() => setInput(prompt[lang as 'es' | 'en'] || prompt.es)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #EAE3D8',
                  borderRadius: 12,
                  color: '#423A31',
                  fontSize: 11.5,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  lineHeight: 1.4,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = prompt.color
                  e.currentTarget.style.backgroundColor = '#FAF8F5'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.04)`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#EAE3D8'
                  e.currentTarget.style.backgroundColor = '#FFFFFF'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                {/* Authentic SVGL Technology Icon */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    backgroundColor: '#F5EFE6',
                    border: '1px solid #E6DFD5',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: '#2A241E' }}>
                    {prompt[lang as 'es' | 'en'] || prompt.es}
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
