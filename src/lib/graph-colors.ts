export function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function getCSSVarAsHex(name: string): string {
  const value = getCSSVar(name)
  if (value.startsWith('#')) return value
  const temp = document.createElement('div')
  temp.style.color = value
  document.body.appendChild(temp)
  const computed = getComputedStyle(temp).color
  document.body.removeChild(temp)
  const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!match) return '#6366f1'
  const [_, r, g, b] = match
  return '#' + [r, g, b].map((v) => parseInt(v).toString(16).padStart(2, '0')).join('')
}

export function getGraphNodeColor(source: 'auto' | 'manual'): string {
  if (source === 'auto') return getCSSVarAsHex('--accent')
  return getCSSVarAsHex('--status-ok')
}

export function getEdgeColor(): string {
  return getCSSVarAsHex('--border-subtle')
}
