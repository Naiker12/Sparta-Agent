import { useState, useEffect } from 'react'
import { Plug, Zap, Check } from 'lucide-react'
import { useMCPStore } from 'ia-sparta-core'
import { BrandIcon } from 'ia-sparta-design-system'
import { REFERENCE_TOOLS_CATALOG } from '../../../ia-sparta-mcp/src/data/mcp-reference-tools'

export interface MentionItem {
  id: string
  name: string
  vendor?: string
  type: 'server' | 'tool'
  toolName?: string
  description?: string
}

interface McpMentionMenuProps {
  query: string
  onSelect: (item: MentionItem) => void
  onClose: () => void
}

export function McpMentionMenu({ query, onSelect, onClose }: McpMentionMenuProps) {
  const { servers } = useMCPStore()
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Build items list from connected servers and tools
  const items: MentionItem[] = []

  servers.forEach((server) => {
    if (server) {
      const refTools = REFERENCE_TOOLS_CATALOG[server.id] ?? []
      const effectiveToolsCount = server.tools.length > 0 ? server.tools.length : refTools.length
      const displayTools = server.tools.length > 0 ? server.tools : refTools
      const toolNames = displayTools.slice(0, 4).map((t) => t.name).join(', ')
      const toolsSummary = displayTools.length > 4 ? `${toolNames}...` : toolNames

      items.push({
        id: server.id,
        name: server.name,
        vendor: server.id,
        type: 'server',
        description: `${effectiveToolsCount} herramientas (${toolsSummary})`,
      })
    }
  })

  // Fallback items if no servers connected yet
  if (items.length === 0) {
    const defaultProviders = [
      { id: 'gmail', name: 'Gmail', vendor: 'gmail', description: '11 herramientas (create_draft, get_thread, label_message, search_threads...)' },
      { id: 'google-drive', name: 'Google Drive', vendor: 'google-drive', description: '3 herramientas (search_files, get_file_metadata, export_doc)' },
      { id: 'github', name: 'GitHub', vendor: 'github', description: '4 herramientas (search_repositories, get_file_contents, create_issue...)' },
      { id: 'slack', name: 'Slack', vendor: 'slack', description: '3 herramientas (list_channels, post_message, read_history)' },
      { id: 'notion', name: 'Notion', vendor: 'notion', description: '3 herramientas (search, get_page, append_block)' },
      { id: 'filesystem', name: 'Filesystem', vendor: 'filesystem', description: '5 herramientas (read_file, write_file, list_directory, directory_tree...)' },
      { id: 'git', name: 'Git', vendor: 'git', description: '4 herramientas (git_status, git_diff, git_log, git_branch)' },
    ]

    defaultProviders.forEach((p) => {
      items.push({
        id: p.id,
        name: p.name,
        vendor: p.vendor,
        type: 'server',
        description: p.description,
      })
    })
  }

  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (filtered.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [filtered, selectedIndex, onSelect, onClose])

  if (filtered.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 8,
        width: 320,
        maxHeight: 260,
        overflowY: 'auto',
        background: 'var(--bg-modal, #18181b)',
        border: '1px solid var(--border-normal, #27272a)',
        borderRadius: 14,
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        padding: '6px',
        zIndex: 100,
        fontFamily: 'var(--font-ui, sans-serif)',
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-muted, #71717a)',
          padding: '6px 8px 4px',
          fontFamily: 'var(--font-mono, monospace)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Plug size={10} />
        Conectores y Herramientas MCP (@)
      </div>

      {filtered.map((item, index) => {
        const isSelected = index === selectedIndex
        return (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setSelectedIndex(index)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 10px',
              borderRadius: 8,
              cursor: 'pointer',
              background: isSelected ? 'var(--bg-active, rgba(255,255,255,0.08))' : 'transparent',
              transition: 'background 0.1s ease',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-elevated, #27272a)',
                border: '1px solid var(--border-subtle, #3f3f46)',
                flexShrink: 0,
              }}
            >
              {item.type === 'server' ? (
                <BrandIcon vendor={item.vendor || 'mcp'} size={14} />
              ) : (
                <Zap size={12} style={{ color: 'var(--accent, #3b82f6)' }} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary, #f4f4f5)',
                  fontFamily: item.type === 'tool' ? 'var(--font-mono, monospace)' : 'var(--font-ui, sans-serif)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{item.name}</span>
                {item.type === 'tool' && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: '1px 4px',
                      borderRadius: 4,
                      background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                      color: 'var(--accent, #3b82f6)',
                    }}
                  >
                    tool
                  </span>
                )}
              </div>

              {item.description && (
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-secondary, #a1a1aa)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 1,
                  }}
                >
                  {item.description}
                </div>
              )}
            </div>

            {isSelected && <Check size={12} style={{ color: 'var(--accent, #3b82f6)' }} />}
          </div>
        )
      })}
    </div>
  )
}
