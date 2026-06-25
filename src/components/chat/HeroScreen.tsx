import { motion } from 'framer-motion'
import { Plus, Code2, Search, Settings } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { useChatStore } from '@/stores/chat.store'
import { SpartaIcon } from '@/components/chat/SpartaIcon'

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
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      padding: '0 40px',
      userSelect: 'none',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--accent-muted)',
          color: 'var(--accent)',
        }}
      >
        <SpartaIcon size={36} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ textAlign: 'center' }}
      >
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(56px, 8vw, 88px)',
          fontWeight: 700,
          color: 'var(--text-display)',
          letterSpacing: '-0.03em',
          lineHeight: 0.92,
          textTransform: 'uppercase',
          background: 'linear-gradient(135deg, var(--text-display) 60%, var(--accent) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          SPARTA<br />AGENT
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
