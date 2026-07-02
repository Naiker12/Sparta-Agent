interface TokenUsagePillProps {
  inputTokens?: number
  outputTokens?: number
  thinkingTokens?: number
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function TokenUsagePill({ inputTokens = 0, outputTokens = 0, thinkingTokens = 0 }: TokenUsagePillProps) {
  const total = inputTokens + outputTokens
  if (total === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span title="Tokens totales">{formatTokens(total)} tok</span>
      {thinkingTokens > 0 && (
        <span title="Tokens de thinking" style={{ color: 'var(--status-think)' }}>
          🧠 {formatTokens(thinkingTokens)}
        </span>
      )}
    </div>
  )
}
