import { useState } from 'react'
import { Wrench } from 'lucide-react'
import type { MCPTool } from 'ia-sparta-core'

interface McpToolItemProps {
  tool: MCPTool
}

export function McpToolItem({ tool }: McpToolItemProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '7px 10px',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Icon badge */}
      <div style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
        color: 'var(--accent)',
      }}>
        <Wrench size={10} strokeWidth={2.5} />
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)', lineHeight: 1.2,
        }}>
          {tool.name}
        </div>
        {tool.description && (
          <div style={{
            fontSize: 10, color: 'var(--text-secondary)',
            fontFamily: 'var(--font-ui)', marginTop: 2, lineHeight: 1.45,
          }}>
            {tool.description}
          </div>
        )}
      </div>
    </div>
  )
}
