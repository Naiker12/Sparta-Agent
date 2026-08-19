import { useState } from 'react'
import { SettingGroup, SettingRow } from '../../shared'
import { useAppearanceStore } from 'ia-sparta-core'
import { Search, ChevronDown, Check, Upload, FolderOpen } from 'lucide-react'

const AVAILABLE_FONTS = [
  { name: 'Inter Variable', label: 'Inter Variable (Predeterminada)', family: 'Inter, system-ui, sans-serif' },
  { name: 'Hellix', label: 'Hellix (Predeterminada)', family: 'Hellix, Inter, sans-serif' },
  { name: 'Space Grotesk Variable', label: 'Space Grotesk Variable', family: 'Space Grotesk, sans-serif' },
  { name: 'Figtree Variable', label: 'Figtree Variable', family: 'Figtree, sans-serif' },
  { name: 'JetBrains Mono', label: 'JetBrains Mono (Predeterminada)', family: 'JetBrains Mono, monospace' },
  { name: 'Geist Mono', label: 'Geist Mono', family: 'Geist Mono, monospace' },
  { name: 'Fira Code', label: 'Fira Code', family: 'Fira Code, monospace' },
  { name: 'Geist Variable', label: 'Geist Variable', family: 'Geist, sans-serif' },
]

function FontDropdown({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = AVAILABLE_FONTS.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) || f.label.toLowerCase().includes(search.toLowerCase())
  )

  const selectedFont = AVAILABLE_FONTS.find((f) => f.family === value || f.name === value) || AVAILABLE_FONTS[0]

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 'var(--radius-md, 8px)',
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          minWidth: 220,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedFont.label}
        </span>
        <ChevronDown size={13} color="var(--text-muted)" />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            width: 250,
            backgroundColor: 'var(--bg-modal)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
            zIndex: 999,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {/* Search bar inside font selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              borderRadius: 6,
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 4,
            }}
          >
            <Search size={12} color="var(--text-muted)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar fuentes..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 11.5,
                color: 'var(--text-primary)',
                width: '100%',
              }}
            />
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '2px 8px' }}>
            Integradas
          </div>

          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filtered.map((font) => {
              const isSelected = font.family === value || font.name === selectedFont.name
              return (
                <div
                  key={font.name}
                  onClick={() => {
                    onChange(font.family)
                    setIsOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 6,
                    backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                    color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: font.family,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <span>{font.name}</span>
                  {isSelected && <Check size={12} strokeWidth={3} color="var(--accent)" />}
                </div>
              )
            })}
          </div>

          {/* Action buttons at bottom */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginTop: 4, paddingLeft: 4, paddingRight: 4 }}>
            <button
              type="button"
              onClick={() => alert('Función para importar archivos TTF/WOFF2 locales')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: 11,
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              <Upload size={11} />
              <span>Subir</span>
            </button>

            <button
              type="button"
              onClick={() => alert('Seleccionar carpeta de fuentes')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: 11,
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              <FolderOpen size={11} />
              <span>Seleccionar carpeta</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function TypographySection() {
  const { fontUI, fontMono, setFontUI, setFontMono } = useAppearanceStore()
  const [titlesFont, setTitlesFont] = useState('Hellix, Inter, sans-serif')
  const [chatFont, setChatFont] = useState('Inter, system-ui, sans-serif')

  return (
    <SettingGroup
      title="Tipografía & Fuentes"
      description="Personaliza las fuentes tipográficas para la interfaz, encabezados, mensajes del chat y bloques de código."
    >
      <SettingRow
        label="Fuente de la interfaz"
        description="Tipografía principal para barras laterales, diálogos y controles."
      >
        <FontDropdown value={fontUI} onChange={setFontUI} />
      </SettingRow>

      <SettingRow
        label="Fuente de los títulos"
        description="Tipografía aplicada a encabezados y títulos de módulos."
      >
        <FontDropdown value={titlesFont} onChange={setTitlesFont} />
      </SettingRow>

      <SettingRow
        label="Fuente del chat"
        description="Tipografía para las burbujas de conversación y respuestas del modelo."
      >
        <FontDropdown value={chatFont} onChange={setChatFont} />
      </SettingRow>

      <SettingRow
        label="Fuente del código"
        description="Tipografía monoespaciada para bloques de código y terminal."
      >
        <FontDropdown value={fontMono} onChange={setFontMono} />
      </SettingRow>
    </SettingGroup>
  )
}
