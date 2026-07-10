import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ChevronRightIcon, Check } from 'lucide-react'
import { getRandomSpinner, type SpinnerSet } from '@/lib/spinners'
import { ShimmerText } from './ShimmerText'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'
import type { ThinkingStatus } from '@/types'
import { useTranslation } from '@/i18n'

interface ThinkingPillProps {
  status: ThinkingStatus
  tokensUsed: number
  isExpanded: boolean
  elapsed: number
  lastSkillName?: string | null
  className?: string
}

const spinner = getRandomSpinner()

export function ThinkingPill({ status, tokensUsed, isExpanded, elapsed, lastSkillName, className }: ThinkingPillProps) {
  const { t } = useTranslation()
  const [frame, setFrame] = useState(0)
  const spinnerRef = useRef<SpinnerSet>(spinner)

  useEffect(() => {
    if (status !== 'starting' && status !== 'streaming') return
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % spinnerRef.current.frames.length)
    }, spinnerRef.current.interval)
    return () => clearInterval(interval)
  }, [status])

  const isActive = status === 'starting' || status === 'streaming'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1', className)}
      style={{
        background: isActive
          ? 'var(--status-think)'
          : 'color-mix(in srgb, var(--status-think) 10%, transparent)',
        color: isActive ? 'var(--text-on-accent)' : 'var(--status-think)',
      }}
    >
      {isActive ? (
        <>
          <span style={{ width: 10, textAlign: 'center', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            {spinnerRef.current.frames[frame]}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', opacity: 0.8, display: 'inline-flex', alignItems: 'center' }}>
            <SlidingNumber number={elapsed} decimalPlaces={1} transition={{ stiffness: 200, damping: 25, mass: 0.3 }} />
            <span>s</span>
          </span>
          <ShimmerText
            text={t('chat.thinking')}
            active
            className="text-[10px] font-medium"
          />
        </>
      ) : (
        <>
          <Check size={12} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', opacity: 0.8, display: 'inline-flex', alignItems: 'center' }}>
            <SlidingNumber number={elapsed} decimalPlaces={1} transition={{ stiffness: 200, damping: 25, mass: 0.3 }} />
            <span>s</span>
          </span>
          <span style={{ fontSize: 10, fontWeight: 500 }}>
            {t('chat.thinking')}
          </span>
          {lastSkillName && (
            <span style={{ fontSize: 9, opacity: 0.6, fontFamily: 'var(--font-mono)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 2 }}>
              &middot; {lastSkillName.replace(/^[^\s]+\s/, '')}
            </span>
          )}
          {tokensUsed > 0 && (
            <span style={{ fontSize: 9, opacity: 0.6, fontFamily: 'var(--font-mono)', marginLeft: 2 }}>
              &middot; {tokensUsed.toLocaleString()} {t('chat.tokensUnit')}
            </span>
          )}
          <ChevronRightIcon
            size={12}
            style={{
              marginLeft: 2,
              flexShrink: 0,
              transition: 'transform 0.15s',
              transform: isExpanded ? 'rotate(90deg)' : 'none',
            }}
          />
        </>
      )}
    </motion.div>
  )
}
