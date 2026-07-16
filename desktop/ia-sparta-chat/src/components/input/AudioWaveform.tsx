interface AudioWaveformProps {
  levels: number[]
  active: boolean
}

export function AudioWaveform({ levels, active }: AudioWaveformProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24, padding: '0 4px' }}>
      {levels.map((level, i) => (
        <div
          key={i}
          style={{
            width: 2,
            height: Math.max(3, level * 22),
            borderRadius: 1,
            background: active ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'height 0.08s ease-out',
          }}
        />
      ))}
    </div>
  )
}
