import { ChevronDown } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu'

const models = [
  { id: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6', provider: 'Anthropic' },
  { id: 'claude-opus-4', label: 'claude-opus-4', provider: 'Anthropic' },
  { id: 'claude-haiku', label: 'claude-haiku', provider: 'Anthropic' },
  { id: 'gpt-4o', label: 'gpt-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', label: 'gpt-4o-mini', provider: 'OpenAI' },
  { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro', provider: 'Google' },
]

export function ModelPicker() {
  const { activeModel, setDefaultModel } = useSettingsStore()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          background: 'none',
          border: '1px solid var(--border-subtle)',
          borderRadius: 20,
          color: 'var(--text-secondary)',
          fontSize: 11.5,
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-normal)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--accent)', flexShrink: 0,
        }} />
        {activeModel}
        <ChevronDown size={10} strokeWidth={2} style={{ marginLeft: 2 }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8}>
        <DropdownMenuLabel>Select Model</DropdownMenuLabel>
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => setDefaultModel(model.id)}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{model.id}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{model.provider}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}