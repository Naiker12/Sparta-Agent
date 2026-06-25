import { Wrench } from 'lucide-react'
import type { MCPTool } from '@/types'

interface McpToolItemProps {
  tool: MCPTool
}

export function McpToolItem({ tool }: McpToolItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-base)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <Wrench size={11} style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {tool.name}
        </div>
        {tool.description && (
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {tool.description}
          </div>
        )}
      </div>
    </div>
  )
}
