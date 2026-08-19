import type { ReactNode } from 'react'

interface HardwareCardProps {
  title: string
  percentage: number
  detail: string
  subDetail?: string
  icon: ReactNode
}

export function HardwareCard({ title, percentage, detail, subDetail, icon }: HardwareCardProps) {
  // Determine color status based on thresholds
  let barColor = 'var(--accent, #6366F1)'
  if (percentage >= 92) {
    barColor = 'var(--status-err, #EF4444)'
  } else if (percentage >= 80) {
    barColor = 'var(--status-warn, #F59E0B)'
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flex: 1,
        minWidth: 200,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            {title}
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: barColor, fontFamily: 'var(--font-mono, monospace)' }}>
          {percentage}%
        </span>
      </div>

      {/* Progress Track */}
      <div
        style={{
          height: 6,
          backgroundColor: 'var(--bg-elevated, var(--bg-hover))',
          borderRadius: 999,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, percentage))}%`,
            backgroundColor: barColor,
            borderRadius: 999,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{detail}</span>
        {subDetail && <span style={{ color: 'var(--text-muted)' }}>{subDetail}</span>}
      </div>
    </div>
  )
}
