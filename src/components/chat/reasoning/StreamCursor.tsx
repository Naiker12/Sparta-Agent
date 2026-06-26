import { useEffect, useState } from 'react'

interface StreamCursorProps {
  visible: boolean
}

export function StreamCursor({ visible }: StreamCursorProps) {
  const [show, setShow] = useState(true)

  useEffect(() => {
    if (!visible) {
      setShow(false)
      return
    }
    const interval = setInterval(() => {
      setShow((s) => !s)
    }, 530)
    return () => clearInterval(interval)
  }, [visible])

  if (!visible) return null

  return (
    <span
      style={{
        display: 'inline-block',
        width: 2,
        height: '1em',
        background: show ? 'var(--accent)' : 'transparent',
        verticalAlign: 'text-bottom',
        marginLeft: 1,
        transition: 'background 0.1s',
        borderRadius: 1,
      }}
    />
  )
}
