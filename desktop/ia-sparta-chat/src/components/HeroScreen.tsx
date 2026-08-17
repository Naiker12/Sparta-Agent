import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Code, Shield, Split, TestTube, Globe, Cpu, Sparkles, RotateCw } from 'lucide-react'
import { useSettingsStore } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'

const EXAMPLE_PROMPTS = [
  { es: '¿Cómo implemento autenticación JWT en Node.js?', en: 'How do I implement JWT authentication in Node.js?', icon: Shield, color: '#10b981' },
  { es: 'Explícame las diferencias entre REST y GraphQL', en: 'Explain the differences between REST and GraphQL', icon: Split, color: '#8b5cf6' },
  { es: 'Refactoriza este código para hacerlo más legible', en: 'Refactor this code to make it more readable', icon: Code, color: '#f59e0b' },
  { es: 'Busca las últimas noticias sobre IA generativa', en: 'Search for the latest news on generative AI', icon: Globe, color: '#3b82f6' },
  { es: 'Escribe tests unitarios para esta función', en: 'Write unit tests for this function', icon: TestTube, color: '#ec4899' },
  { es: '¿Cuál es la complejidad temporal de quicksort?', en: 'What is the time complexity of quicksort?', icon: Cpu, color: '#06b6d4' },
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
    <div style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '0 40px',
      userSelect: 'none',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 10 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
          y: [0, -8, 0]
        }}
        transition={{ 
          opacity: { duration: 0.5 },
          scale: { duration: 0.5 },
          y: {
            repeat: Infinity,
            duration: 4,
            ease: "easeInOut",
            delay: 0.5
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 220,
          height: 135,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Glow de acento de marca Detrás del Logo */}
        <div style={{
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <img
          src="./sparta-icon.png"
          alt="Sparta"
          style={{
            position: 'absolute',
            top: -28,
            width: 220,
            height: 220,
            objectFit: 'contain',
            filter: 'var(--invert-logo)',
          }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        style={{ textAlign: 'center' }}
      >
        <h1 
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 5vw, 42px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text-display)',
            lineHeight: 1.25,
            marginBottom: 6,
          }}
        >
          {t('chat.heroTitle') || 'Chat with Sparta Agent'}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            textAlign: 'center',
            maxWidth: 480,
            lineHeight: 1.5,
            fontWeight: 400,
            fontFamily: 'var(--font-ui)',
          }}
        >
          {t('chat.welcome') || 'Run local LLMs, cloud models, agents & MCP tools'}
        </p>
      </motion.div>





      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{
          width: '100%',
          maxWidth: 480,
          marginTop: 8,
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'between',
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <Sparkles size={12} style={{ color: 'var(--accent)', opacity: 0.7 }} />
            <span style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 500,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}>
              {t('chat.tryWith')}
            </span>
          </div>
          <button
            onClick={shufflePrompts}
            title={t('chat.suggestions')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              borderRadius: '50%',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--accent)'
              e.currentTarget.style.background = 'var(--accent-muted)'
              const icon = e.currentTarget.querySelector('svg')
              if (icon) icon.style.transform = 'rotate(180deg)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.background = 'none'
              const icon = e.currentTarget.querySelector('svg')
              if (icon) icon.style.transform = 'rotate(0deg)'
            }}
          >
            <RotateCw size={12} style={{ transition: 'transform 0.3s ease' }} />
          </button>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
        }}>
          {prompts.map((prompt, idx) => {
            const Icon = prompt.icon
            return (
              <motion.button
                key={prompt.es}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + idx * 0.07, duration: 0.3, ease: 'easeOut' }}
                onClick={() => setInput(prompt[lang as 'es' | 'en'] || prompt.es)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  color: 'var(--text-secondary)',
                  fontSize: 11.5,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  textAlign: 'left',
                  lineHeight: 1.45,
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget
                  el.style.borderColor = prompt.color
                  el.style.background = `color-mix(in srgb, ${prompt.color} 6%, var(--bg-surface))`
                  el.style.transform = 'translateY(-1px)'
                  el.style.boxShadow = `0 4px 12px color-mix(in srgb, ${prompt.color} 12%, transparent)`
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  el.style.borderColor = 'var(--border-subtle)'
                  el.style.background = 'var(--bg-surface)'
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = 'none'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: `color-mix(in srgb, ${prompt.color} 12%, transparent)`,
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  <Icon size={13} style={{ color: prompt.color }} strokeWidth={2} />
                </div>
                <span style={{ flex: 1, paddingTop: 3 }}>{prompt[lang as 'es' | 'en'] || prompt.es}</span>
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
