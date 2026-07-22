import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Code, Search, Settings, Shield, Split, TestTube, Globe, Cpu, Sparkles, RotateCw } from 'lucide-react'
import { useSettingsStore } from 'ia-sparta-core'
import { useSessionStore } from 'ia-sparta-core'
import { useSessionTabsStore } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'

const QUICK_ACTIONS = [
  { icon: Plus,    labelKey: 'sidebar.newSession', action: 'new' as const },
  { icon: Code,   labelKey: 'chat.activeSkills',  action: 'coding' as const, fallbackLabel: 'Código' },
  { icon: Search,  labelKey: 'sidebar.agents',     action: 'research' as const, fallbackLabel: 'Investigar' },
  { icon: Settings,labelKey: 'sidebar.settings',   action: 'settings' as const },
]

const EXAMPLE_PROMPTS = [
  { es: '¿Cómo implemento autenticación JWT en Node.js?', en: 'How do I implement JWT authentication in Node.js?', icon: Shield, color: '#10b981' },
  { es: 'Explícame las diferencias entre REST y GraphQL', en: 'Explain the differences between REST and GraphQL', icon: Split, color: '#8b5cf6' },
  { es: 'Refactoriza este código para hacerlo más legible', en: 'Refactor this code to make it more readable', icon: Code, color: '#f59e0b' },
  { es: 'Busca las últimas noticias sobre IA generativa', en: 'Search for the latest news on generative AI', icon: Globe, color: '#3b82f6' },
  { es: 'Escribe tests unitarios para esta función', en: 'Write unit tests for this function', icon: TestTube, color: '#ec4899' },
  { es: '¿Cuál es la complejidad temporal de quicksort?', en: 'What is the time complexity of quicksort?', icon: Cpu, color: '#06b6d4' },
]

export function HeroScreen() {
  const { openSettings, setInput } = useSettingsStore()
  const { createSession } = useSessionStore()
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

  function handleAction(action: string) {
    if (action === 'settings') { openSettings(); return }
    if (action === 'new') {
      const id = createSession()
      useSessionTabsStore.getState().openTab(id)
      return
    }
    const promptsConfig: Record<string, string> = {
      coding:   t('chat.activeSkills') === 'Código' ? 'Ayúdame a refactorizar este código: ' : 'Help me refactor this code: ',
      research: t('chat.activeSkills') === 'Código' ? 'Investiga en profundidad sobre: ' : 'Research in depth about: ',
    }
    if (promptsConfig[action]) setInput(promptsConfig[action])
  }

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
        <img
          src="/sparta-icon.png"
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
        initial={{ opacity: 0, y: 15 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          scale: [1, 1.02, 1]
        }}
        transition={{ 
          opacity: { duration: 0.5, delay: 0.15 },
          y: { duration: 0.5, delay: 0.15 },
          scale: {
            repeat: Infinity,
            duration: 4,
            ease: "easeInOut",
            delay: 0.5
          }
        }}
        style={{ textAlign: 'center' }}
      >
        <h1 
          className="hero-gradient-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(44px, 7vw, 56px)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            textTransform: 'uppercase',
          }}
        >
          SPARTA AGENT
        </h1>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          fontSize: 13.5,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          maxWidth: 440,
          lineHeight: 1.6,
          fontWeight: 400,
          fontFamily: 'var(--font-ui)',
        }}
      >
        {t('chat.welcome')}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.18 }}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}
      >
        {QUICK_ACTIONS.map(({ icon: Icon, labelKey, action, fallbackLabel }) => (
          <button
            key={action}
            onClick={() => handleAction(action)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              background: 'none',
              border: '1px solid var(--border-normal)',
              borderRadius: 20,
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.color = 'var(--accent)'
              e.currentTarget.style.background = 'var(--accent-muted)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-normal)'
              e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.background = 'none'
            }}
          >
            <Icon size={12} strokeWidth={1.8} />
            {t(labelKey) || fallbackLabel}
          </button>
        ))}
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
