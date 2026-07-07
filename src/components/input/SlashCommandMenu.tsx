import { useEffect, useRef, useState, useCallback } from 'react'
import type { Skill } from '@/types'

export interface SlashCommand {
  name: string
  description: string
  usage: string
  action: (args: string) => void
}

let _cachedSkills: Skill[] = []

export function setSlashSkillCache(skills: Skill[]) {
  _cachedSkills = skills
}

const COMMANDS: SlashCommand[] = [
  {
    name: 'clear',
    description: 'Limpiar la conversación actual',
    usage: '/clear',
    action: () => {
      const { useSessionStore } = require('@/stores/session.store')
      const { useChatStore } = require('@/stores/chat.store')
      const sid = useSessionStore.getState().activeSessionId
      if (sid) {
        useSessionStore.getState().deleteSession(sid)
        useChatStore.getState().deleteSessionMessages(sid)
      }
    },
  },
  {
    name: 'model',
    description: 'Cambiar el modelo activo',
    usage: '/model <nombre>',
    action: (args) => {
      if (!args) return
      const { useSettingsStore } = require('@/stores/settings.store')
      useSettingsStore.getState().setDefaultModel(args.trim())
    },
  },
  {
    name: 'memory',
    description: 'Activar o desactivar memoria persistente',
    usage: '/memory on|off',
    action: (args) => {
      const { useSettingsStore } = require('@/stores/settings.store')
      const state = useSettingsStore.getState()
      if (args.trim() === 'on' && !state.memoryEnabled) state.toggleMemory()
      else if (args.trim() === 'off' && state.memoryEnabled) state.toggleMemory()
    },
  },
  {
    name: 'reasoning',
    description: 'Controlar razonamiento: on|off|show|hide|full|none|low|medium|high',
    usage: '/reasoning <show|hide|full|clamp|on|off|none|low|medium|high|xhigh>',
    action: (args) => {
      const { useSettingsStore } = require('@/stores/settings.store')
      const state = useSettingsStore.getState()
      const arg = args.trim().toLowerCase()
      if (arg === 'on' && !state.reasoningEnabled) state.toggleReasoning()
      else if (arg === 'off' && state.reasoningEnabled) state.toggleReasoning()
      else if (['none', 'minimal', 'low', 'medium', 'high', 'xhigh'].includes(arg)) {
        const { useSettingsStore } = require('@/stores/settings.store')
        useSettingsStore.getState().setReasoningEffort(arg as 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh')
        if (!state.reasoningEnabled) state.toggleReasoning()
      }
    },
  },
  {
    name: 'help',
    description: 'Mostrar comandos disponibles',
    usage: '/help',
    action: () => {
      const { useSessionStore } = require('@/stores/session.store')
      const { useChatStore } = require('@/stores/chat.store')
      const sid = useSessionStore.getState().activeSessionId
      if (!sid) return
      const content = COMMANDS.map((c) => `- \`${c.usage}\` — ${c.description}`).join('\n')
      useChatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Comandos disponibles:**\n\n${content}`,
        timestamp: Date.now(),
        sessionId: sid,
      })
    },
  },
  {
    name: 'skill',
    description: 'Activar o desactivar una skill por ID, o ver lista',
    usage: '/skill <id> [on|off|view]',
    action: (args) => {
      const [skillId, action] = args.trim().split(/\s+/)
      if (!skillId) {
        const names = _cachedSkills.map((s) => `  \u2022 /${s.id} - ${s.name}`).join('\n')
        const { useSessionStore } = require('@/stores/session.store')
        const { useChatStore } = require('@/stores/chat.store')
        const sid = useSessionStore.getState().activeSessionId
        if (!sid) return
        useChatStore.getState().addMessage({
          id: crypto.randomUUID(), role: 'assistant', content: `**Skills disponibles:**\n\n${names}\n\nUsa \`/skill <id> on\` para activar una skill.`, timestamp: Date.now(), sessionId: sid,
        })
        return
      }
      const { useSkillStore } = require('@/stores/skill.store')
      const store = useSkillStore.getState()
      const isCurrentlyActive = store.activeSkillIds.includes(skillId)
      if (action === 'on' || (action === undefined && !isCurrentlyActive)) {
        if (!isCurrentlyActive) store.toggleActive(skillId)
      } else if (action === 'off' || (action === undefined && isCurrentlyActive)) {
        if (isCurrentlyActive) store.toggleActive(skillId)
      } else if (action === 'view') {
        const skill = _cachedSkills.find((s) => s.id === skillId)
        if (!skill) return
        const { useSessionStore } = require('@/stores/session.store')
        const { useChatStore } = require('@/stores/chat.store')
        const sid = useSessionStore.getState().activeSessionId
        if (!sid) return
        useChatStore.getState().addMessage({
          id: crypto.randomUUID(), role: 'assistant', content: `**${skill.name}**\n\n${skill.description || 'Sin descripci\u00f3n.'}`, timestamp: Date.now(), sessionId: sid,
        })
      }
    },
  },
  // Auto-generated /<skill-id> commands (filled by setSlashSkillCache)
]

export function parseSlashCommand(text: string): { command: SlashCommand; args: string } | null {
  if (!text.startsWith('/')) return null
  const parts = text.slice(1).split(/\s+/)
  const name = parts[0].toLowerCase()
  const args = parts.slice(1).join(' ')

  // Build skill commands for lookup
  const skillCommands: SlashCommand[] = _cachedSkills.map((skill) => ({
    name: skill.id,
    description: `Activar skill: ${skill.name}`,
    usage: `/${skill.id}`,
    action: () => {
      const { useSkillStore } = require('@/stores/skill.store')
      const store = useSkillStore.getState()
      if (!store.activeSkillIds.includes(skill.id)) {
        store.toggleActive(skill.id)
      }
    },
  }))

  const allCommands = [...COMMANDS, ...skillCommands]
  const cmd = allCommands.find((c) => c.name === name)
  return cmd ? { command: cmd, args } : null
}

export function getSlashSuggestions(text: string): SlashCommand[] {
  if (!text.startsWith('/')) return []
  const parts = text.slice(1).split(/\s+/)
  const partial = parts[0].toLowerCase()
  if (parts.length > 1) return []

  // Build dynamic skill commands
  const skillCommands: SlashCommand[] = _cachedSkills.map((skill) => ({
    name: skill.id,
    description: `Activar skill: ${skill.name}`,
    usage: `/${skill.id}`,
    action: () => {
      const { useSkillStore } = require('@/stores/skill.store')
      const store = useSkillStore.getState()
      if (!store.activeSkillIds.includes(skill.id)) {
        store.toggleActive(skill.id)
      }
    },
  }))

  const allCommands = [...COMMANDS, ...skillCommands]
  return allCommands.filter((c) => c.name.startsWith(partial))
}

interface SlashCommandMenuProps {
  text: string
  onSelect: (command: SlashCommand) => void
  onClose: () => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}

export function SlashCommandMenu({ text, onSelect, onClose, inputRef }: SlashCommandMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const suggestions = getSlashSuggestions(text)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (suggestions[selectedIndex]) {
        onSelect(suggestions[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [suggestions, selectedIndex, onSelect, onClose])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, inputRef])

  useEffect(() => {
    setSelectedIndex(0)
  }, [suggestions.length])

  useEffect(() => {
    if (!ref.current) return
    const activeEl = ref.current.children[selectedIndex] as HTMLElement
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (suggestions.length === 0) return null

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: 0,
        width: 320,
        maxHeight: 260,
        overflowY: 'auto',
        background: 'var(--bg-modal)',
        border: '1px solid var(--border-normal)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        padding: 4,
      }}
    >
      {suggestions.map((cmd, i) => (
        <button
          key={cmd.name}
          onClick={() => onSelect(cmd)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            background: i === selectedIndex ? 'var(--bg-hover)' : 'none',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background 0.08s',
          }}
        >
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {cmd.usage.split(' ')[0]}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cmd.description}
          </span>
        </button>
      ))}
    </div>
  )
}

export function executeSlashCommand(text: string): boolean {
  const parsed = parseSlashCommand(text)
  if (!parsed) return false
  parsed.command.action(parsed.args)
  return true
}
