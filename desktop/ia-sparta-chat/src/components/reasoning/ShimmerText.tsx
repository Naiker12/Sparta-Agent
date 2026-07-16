import { cn } from 'ia-sparta-core'

interface ShimmerTextProps {
  text: string
  active: boolean
  className?: string
}

export function ShimmerText({ text, active, className }: ShimmerTextProps) {
  return (
    <span className={cn('shimmer-text', active && 'shimmer-text-active', className)}>
      {text}
    </span>
  )
}
