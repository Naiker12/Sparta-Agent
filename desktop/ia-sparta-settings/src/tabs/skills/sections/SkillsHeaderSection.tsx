import { Search, Plus } from 'lucide-react'

interface SkillsHeaderProps {
  search: string
  onSearchChange: (val: string) => void
  categories: string[]
  selectedCategory: string
  onSelectCategory: (cat: string) => void
  onNewSkill: () => void
}

export function SkillsHeaderSection({
  search,
  onSearchChange,
  categories,
  selectedCategory,
  onSelectCategory,
  onNewSkill,
}: SkillsHeaderProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '6px 12px',
            flex: 1,
            maxWidth: 340,
          }}
        >
          <Search size={14} color="var(--text-muted)" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar habilidades por nombre o etiqueta..."
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              outline: 'none',
              width: '100%',
            }}
          />
        </div>

        {/* Create Skill Button */}
        <button
          type="button"
          onClick={onNewSkill}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 'var(--radius-md, 8px)',
            backgroundColor: 'var(--accent)',
            border: 'none',
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <Plus size={13} />
          <span>Nueva Habilidad</span>
        </button>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-elevated, var(--bg-hover))',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: 11.5,
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              {cat}
            </button>
          )
        })}
      </div>
    </div>
  )
}
