import { motion } from 'framer-motion'
import { Plus, Code2, Search, Settings } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { useChatStore } from '@/stores/chat.store'

const QUICK_ACTIONS = [
  { icon: Plus,    label: 'New chat',   action: 'new' as const },
  { icon: Code2,   label: 'Coding',     action: 'coding' as const },
  { icon: Search,  label: 'Research',   action: 'research' as const },
  { icon: Settings,label: 'Settings',   action: 'settings' as const },
]

export function HeroScreen() {
  const { openSettings, setInput } = useSettingsStore()
  const { createSession } = useChatStore()

  function handleAction(action: string) {
    if (action === 'settings') { openSettings(); return }
    if (action === 'new') { createSession(); return }
    const prompts: Record<string, string> = {
      coding:   'Ayúdame a refactorizar este código: ',
      research: 'Investiga en profundidad sobre: ',
    }
    if (prompts[action]) setInput(prompts[action])
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
        Describe tu tarea. Elegiré las herramientas,
        explicaré el plan y confirmaré antes de acciones riesgosas.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.18 }}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}
      >
        {QUICK_ACTIONS.map(({ icon: Icon, label, action }) => (
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
            {label}
          </button>
        ))}
      </motion.div>
    </div>
  )
}
