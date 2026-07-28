interface SkillToggleProps {
  active: boolean
  onChange: (next: boolean) => void
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
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${active ? 'bg-[#0070f3]' : 'bg-[#333338] hover:bg-[#3f3f46]'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          active ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
