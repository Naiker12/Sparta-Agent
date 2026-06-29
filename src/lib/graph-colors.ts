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
  const [, r, g, b] = match
  return '#' + [r, g, b].map((v) => parseInt(v).toString(16).padStart(2, '0')).join('')
}

const CATEGORY_COLORS: Record<string, string> = {
  entity:    '#7c9ef8',
  fact:      '#6bd49a',
  relation:  '#f8c77c',
  project:   '#c47cf8',
  preference:'#f87c9e',
  code:      '#7cf8f0',
  manual:    '#f8f87c',
  auto:      '#c4c4d4',
}

export function getGraphNodeColor(source: 'auto' | 'manual', category?: string): string {
  if (category && CATEGORY_COLORS[category.toLowerCase()]) {
    return CATEGORY_COLORS[category.toLowerCase()]
  }
  return source === 'manual' ? CATEGORY_COLORS.manual : CATEGORY_COLORS.auto
}

export function getEdgeColor(): string {
  return getCSSVarAsHex('--border-subtle')
}
