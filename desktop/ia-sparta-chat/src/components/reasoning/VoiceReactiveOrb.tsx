import { useEffect, useRef } from 'react'
import { ThinkingOrb } from 'thinking-orbs'
import { getVoiceActivitySnapshot, subscribeVoiceActivity } from 'ia-sparta-core'

interface VoiceReactiveOrbProps {
  active: boolean
  size?: 20 | 64
}

/** Visual-only microphone feedback. Audio amplitude mutates the wrapper DOM
 * node directly so it does not trigger a React render for every audio frame. */
export function VoiceReactiveOrb({ active, size = 20 }: VoiceReactiveOrbProps) {
  const nodeRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const update = () => {
      const node = nodeRef.current
      if (!node) return
      const { amplitude, isVoiceActive } = getVoiceActivitySnapshot()
      const strength = active ? amplitude : 0
      node.style.transform = `scale(${1 + strength * 0.22})`
      node.style.filter = `drop-shadow(0 0 ${Math.round(strength * 12)}px var(--accent))`
      node.style.opacity = active ? (isVoiceActive ? '1' : '0.72') : '0'
    }
    update()
    return subscribeVoiceActivity(update)
  }, [active])

  return (
    <span
      ref={nodeRef}
      aria-label={active ? 'Micrófono escuchando' : undefined}
      role={active ? 'status' : undefined}
      style={{ display: 'inline-flex', transition: 'transform 80ms ease-out, filter 80ms ease-out, opacity 120ms ease-out' }}
    >
      <ThinkingOrb state="listening" size={size} />
    </span>
  )
}
