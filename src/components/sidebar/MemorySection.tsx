import { useState } from 'react'
import { Brain } from 'lucide-react'
import { useMemoryStore } from '@/stores/memory.store'
import { SidebarSection } from './SidebarSection'
import { MemoryDialog } from '@/components/memory/MemoryDialog'

export function MemorySection() {
  const { entries } = useMemoryStore()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <SidebarSection title="Memoria" count={`${entries.length} recuerdos`}>
        <div
          onClick={() => setDialogOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            cursor: 'pointer',
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Brain size={12} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Ver / Gestionar
          </span>
        </div>
      </SidebarSection>

      <MemoryDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  )
}
