import { useRef, useState, useEffect } from 'react'
import { Plus, ArrowUp, Square, AlertCircle } from 'lucide-react'
import { toast } from 'ia-sparta-design-system'
import { useSettingsStore } from 'ia-sparta-core'
import { useChatStore } from 'ia-sparta-core'
import { useSessionStore } from 'ia-sparta-core'
import { useProviderStore } from 'ia-sparta-core'
import { useChatSession } from 'ia-sparta-core'
import { useLocalSkillsLoader } from 'ia-sparta-core'
import { cn } from 'ia-sparta-core'
import { messagingAdapter } from 'ia-sparta-platform'
import { ModelPicker } from './ModelPicker'
import { AttachMenu } from './AttachMenu'
import { VoiceRecordButton } from './VoiceRecordButton'
import { ModeSwitch } from './input/ModeSwitch'
import { SkillSuggestionChip } from './input/SkillSuggestionChip'
import { SlashCommandMenu, executeSlashCommand, type SlashCommand, setSlashSkillCache } from './SlashCommandMenu'
import { McpMentionMenu, type MentionItem } from './McpMentionMenu'
import { BrandIcon } from 'ia-sparta-design-system'
import { X } from 'lucide-react'
import { ProjectDialog } from 'ia-sparta-projects'
import { useTranslation } from 'ia-sparta-i18n'
import { HostPickerButton, WorkspaceModePicker } from 'ia-sparta-shell-layout'

interface ChatInputProps {
  sessionId?: string
  className?: string
}

export function ChatInput({ sessionId, className }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const justSelectedRef = useRef(false)
  const [focused, setFocused] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const [showSlash, setShowSlash] = useState(false)
  const [showMention, setShowMention] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [activeMentions, setActiveMentions] = useState<MentionItem[]>([])
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const { input, setInput } = useSettingsStore()
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const resolvedSessionId = sessionId ?? activeSessionId
  const isStreaming = useChatStore((s) => resolvedSessionId ? (s.streamingBySession[resolvedSessionId]?.isStreaming ?? false) : s.isStreaming)
  const providers = useProviderStore((s) => s.providers)
  const apiKeys = useSettingsStore((s) => s.apiKeys)
  const hasProvider = providers.length > 0 && providers.some((p) => {
    if (p.kind === 'local') return true
    if (p.hasVaultKey) return true
    if (p.apiKey && p.apiKey.trim().length > 0) return true
    if (apiKeys[p.vendor] && apiKeys[p.vendor].trim().length > 0) return true
    if (apiKeys[p.id] && apiKeys[p.id].trim().length > 0) return true
    return true
  })
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const injectWhileStreaming = useChatStore((s) => s.injectWhileStreaming)
  const { sendMessage } = useChatSession(resolvedSessionId ?? undefined)
  const { t, lang } = useTranslation()

  const { skills: localSkills } = useLocalSkillsLoader()

  useEffect(() => {
    const mapped = (localSkills as unknown as { id: string; name: string; description?: string }[]).map((s) => ({
      id: s.id, name: s.name, description: s.description || '', prompt: '', createdAt: Date.now(),
    }))
    setSlashSkillCache(mapped)
  }, [localSkills])

  useEffect(() => {
    setShowSlash(input.startsWith('/') && input.length > 0)
  }, [input])

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function handleInputChange(val: string) {
    setInput(val)
    autoResize()

    const lastAtPos = val.lastIndexOf('@')
    if (lastAtPos !== -1 && (lastAtPos === 0 || val[lastAtPos - 1] === ' ')) {
      const q = val.substring(lastAtPos + 1)
      if (!q.includes(' ')) {
        setMentionQuery(q)
        setShowMention(true)
        return
      }
    }
    setShowMention(false)
  }

  function handleMentionSelect(item: MentionItem) {
    if (!activeMentions.some((m) => m.id === item.id)) {
      setActiveMentions((prev) => [...prev, item])
    }
    const lastAtPos = input.lastIndexOf('@')
    if (lastAtPos !== -1) {
      setInput(input.substring(0, lastAtPos))
    }
    setShowMention(false)
    textareaRef.current?.focus()
  }

  function handleSend() {
    if (justSelectedRef.current) return
    let text = input.trim()
    if (!text) return
    if (!hasProvider) return

    if (activeMentions.length > 0) {
      const mentionHeader = activeMentions.map((m) => `@${m.name}`).join(' ')
      text = `${mentionHeader} ${text}`
    }

    if (executeSlashCommand(text)) {
      setInput('')
      setActiveMentions([])
      return
    }

    if (isStreaming) {
      injectWhileStreaming(text)
      setInput('')
      setActiveMentions([])
      toast.info(t('chat.messageQueued'))
      return
    }

    sendMessage(text)
    setInput('')
    setActiveMentions([])
  }

  function handleStop() {
    const sid = resolvedSessionId
    if (sid) {
      stopStreaming(sid)
      messagingAdapter.abortMessage(sid)
    } else {
      stopStreaming()
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (showMention || showSlash) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        justSelectedRef.current = true
        setTimeout(() => { justSelectedRef.current = false }, 300)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMention(false)
        setShowSlash(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (hasProvider) {
        handleSend()
      }
    }
  }

  function handleSlashSelect(cmd: SlashCommand) {
    justSelectedRef.current = true
    setShowSlash(false)
    const baseCmd = `/${cmd.name}`
    if (cmd.usage.trim() === baseCmd) {
      cmd.action('')
      setInput('')
    } else {
      const prefix = cmd.usage.split(' ')[0] || baseCmd
      setInput(`${prefix} `)
    }
    setTimeout(() => {
      justSelectedRef.current = false
      textareaRef.current?.focus()
    }, 300)
  }

  const [isRedirectMode, setIsRedirectMode] = useState(false)
  const [typedText, setTypedText] = useState('')
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (isStreaming) {
      setIsRedirectMode(true)
    } else {
      setIsRedirectMode(false)
    }
  }, [isStreaming])

  useEffect(() => {
    if (!hasProvider || isStreaming || input.length > 0) {
      setTypedText('')
      return
    }

    const phrases = lang === 'es' ? [
      'Pregunta lo que quieras...',
      'Explica este pedazo de código...',
      'Crea un script en Python...',
      'Ayúdame a debugear un error...',
      '¿Cómo puedo optimizar esta función?...',
      'Escribe un comando usando /...',
    ] : [
      'Ask anything...',
      'Explain this piece of code...',
      'Create a Python script...',
      'Help me debug an error...',
      'How can I optimize this function?...',
      'Type a command using /...',
    ]

    const currentPhrase = phrases[phraseIndex]
    const typeSpeed = isDeleting ? 30 : 60
    const delayTimeout = !isDeleting && typedText === currentPhrase
      ? 2000
      : isDeleting && typedText === ''
        ? 500
        : typeSpeed

    const handleType = () => {
      if (!isDeleting) {
        setTypedText(currentPhrase.substring(0, typedText.length + 1))
        if (typedText === currentPhrase) {
          setIsDeleting(true)
        }
      } else {
        setTypedText(currentPhrase.substring(0, typedText.length - 1))
        if (typedText === '') {
          setIsDeleting(false)
          setPhraseIndex((prev) => (prev + 1) % phrases.length)
        }
      }
    }

    const timer = setTimeout(handleType, delayTimeout)
    return () => clearTimeout(timer)
  }, [typedText, isDeleting, phraseIndex, hasProvider, isStreaming, lang, input])

  const placeholder = !hasProvider
    ? t('chat.placeholderNoProvider')
    : isStreaming && isRedirectMode
      ? t('chat.placeholderRedirect')
      : isStreaming
        ? t('chat.placeholderStreaming')
        : typedText || t('chat.placeholderDefault')

  const canSend = input.trim().length > 0 && hasProvider

  return (
    <div className={className} style={{ position: 'relative', paddingBottom: 16 }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {!hasProvider && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            marginBottom: 8,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--status-warn)',
            background: 'color-mix(in srgb, var(--status-warn) 8%, transparent)',
            fontSize: 12,
            color: 'var(--status-warn)',
            fontFamily: 'var(--font-ui)',
          }}>
            <AlertCircle size={14} strokeWidth={1.5} />
            <span>
              {t('chat.noProviderWarning')}{' '}
              <button
                onClick={() => useSettingsStore.getState().openSettings()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 12,
                  padding: 0,
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {t('chat.configureProvider')}
              </button>
              {' '}{t('chat.configureProviderSuffix')}
            </span>
          </div>
        )}

        <div className={cn('chat-input-wrapper', isStreaming && 'is-streaming')}>
          <div
            style={{
              background: 'var(--bg-input)',
              borderRadius: 'inherit',
              boxShadow: focused
                ? '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--accent-glow)'
                : '0 4px 20px rgba(0,0,0,0.3)',
              transition: 'box-shadow 0.15s',
            }}
          >
            {activeMentions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px 2px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                  MCP CONECTORES:
                </span>
                {activeMentions.map((m) => (
                  <span
                    key={m.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                      color: 'var(--accent)',
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'var(--font-ui)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                  >
                    <BrandIcon vendor={m.vendor || 'mcp'} size={12} />
                    {m.name}
                    <button
                      type="button"
                      onClick={() => setActiveMentions((prev) => prev.filter((item) => item.id !== m.id))}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1 }}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '10px 14px 8px',
            }}>
              <div style={{ flex: 1, position: 'relative' }}>
                {showMention && (
                  <McpMentionMenu
                    query={mentionQuery}
                    onSelect={handleMentionSelect}
                    onClose={() => setShowMention(false)}
                  />
                )}
                {showSlash && (
                  <SlashCommandMenu
                    text={input}
                    onSelect={handleSlashSelect}
                    onClose={() => setShowSlash(false)}
                    inputRef={textareaRef}
                  />
                )}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={handleKey}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={placeholder}
                  rows={1}
                  style={{
                    flex: 1,
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 13.5,
                    fontFamily: 'var(--font-ui)',
                    lineHeight: 1.55,
                    resize: 'none',
                    minHeight: 22,
                    maxHeight: 120,
                    caretColor: hasProvider ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                />
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px 10px',
              gap: 8,
            }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => setShowAttach(!showAttach)}
                  style={{
                    width: 28,
                    height: 28,
                    background: showAttach ? 'var(--bg-active)' : 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: showAttach ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.12s',
                  }}
                >
                  <Plus size={13} strokeWidth={2} />
                </button>
                {showAttach && <AttachMenu onClose={() => setShowAttach(false)} />}
              </div>

              <ModelPicker />

              <div style={{ flex: 1 }} />

              {isStreaming && (
                <div style={{ fontSize: 10, color: 'var(--status-warn)', fontFamily: 'var(--font-ui)', paddingRight: 4 }}>
                  {t('chat.redirectHint')}
                </div>
              )}
              <VoiceRecordButton onTranscript={(text) => {
                const current = useSettingsStore.getState().input
                setInput(current + text)
              }} />

              {isStreaming ? (
                <button
                  onClick={handleStop}
                  style={{
                    width: 28, height: 28,
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <Square size={11} strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  onClick={() => canSend && handleSend()}
                  style={{
                    width: 28, height: 28,
                    background: canSend ? 'var(--accent)' : 'var(--bg-active)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    color: canSend ? 'white' : 'var(--text-muted)',
                    cursor: canSend ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                    transform: canSend ? 'scale(1)' : 'scale(0.95)',
                  }}
                >
                  <ArrowUp size={13} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom chips row (Traycer Style: Host Picker + Workspace/Mode + ModeSwitch) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 6,
          paddingLeft: 4,
          flexWrap: 'wrap',
        }}>
          <HostPickerButton />
          <WorkspaceModePicker />
          <SkillSuggestionChip />
          <div style={{ flex: 1 }} />
          <ModeSwitch />
        </div>

        <ProjectDialog open={showFolderDialog} onClose={() => setShowFolderDialog(false)} />
      </div>
    </div>
  )
}
