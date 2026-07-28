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
  disabled = false,
  ariaLabel = 'Toggle skill',
  stopPropagation = true,
}: SkillToggleProps) {
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
      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${active ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span
        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-background shadow-sm ring-0 transition duration-200 ease-in-out ${
          active ? 'translate-x-3' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
