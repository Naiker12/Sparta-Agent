interface SkillToggleProps {
  active: boolean
  onChange: (next: boolean) => void
  size?: number
  disabled?: boolean
  ariaLabel?: string
  stopPropagation?: boolean
}

export function SkillToggle({
  active,
  onChange,
  size = 32,
  disabled = false,
  ariaLabel = 'Toggle skill',
  stopPropagation = true,
}: SkillToggleProps) {
  const height = size * 0.56
  const knobSize = height - 4
  const offset = size - knobSize - 4

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        if (disabled) return
        if (stopPropagation) e.stopPropagation()
        onChange(!active)
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.opacity = '0.85'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1'
      }}
      style={{
        width: size,
        height,
        borderRadius: height,
        border: 'none',
        padding: 0,
        position: 'relative',
        background: active && !disabled ? 'var(--accent)' : 'var(--bg-active)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        outline: 'none',
        boxShadow: '0 0 0 2px transparent',
        transition: 'background 0.15s ease, opacity 0.15s ease',
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)'
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 2px transparent'
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: knobSize,
          height: knobSize,
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transform: `translateX(${active ? offset : 0}px)`,
          transition: 'transform 0.15s ease',
        }}
      />
    </button>
  )
}
