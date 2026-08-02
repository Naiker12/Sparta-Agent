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
  // Entidades y Usuarios
  entity:      '#3b82f6', // Electric Blue
  entidad:     '#3b82f6',
  user:        '#3b82f6',
  usuario:     '#3b82f6',

  // Hechos y Datos
  fact:        '#10b981', // Emerald Green
  hecho:       '#10b981',
  dato:        '#10b981',

  // Preferencias
  preference:  '#ec4899', // Hot Pink
  preferencia: '#ec4899',
  'pref.':     '#ec4899',
  pref:        '#ec4899',

  // Proyectos y Tareas
  project:     '#8b5cf6', // Violet Purple
  proyecto:    '#8b5cf6',
  tarea:       '#8b5cf6',

  // Código y Tecnología
  code:        '#06b6d4', // Bright Cyan
  código:      '#06b6d4',
  codigo:      '#06b6d4',
  tech:        '#06b6d4',

  // Relaciones y Sistema
  relation:    '#f59e0b', // Amber Orange
  relación:    '#f59e0b',
  relacion:    '#f59e0b',
  mcp:         '#f59e0b',

  // Fuentes
  manual:      '#eab308', // Gold
  auto:        '#6366f1', // Indigo Glow
}

export function getGraphNodeColor(source: 'auto' | 'manual', category?: string): string {
  if (category) {
    const key = category.toLowerCase().trim()
    if (CATEGORY_COLORS[key]) {
      return CATEGORY_COLORS[key]
    }
  }
  return source === 'manual' ? CATEGORY_COLORS.manual : CATEGORY_COLORS.auto
}

export function getEdgeColor(): string {
  return getCSSVarAsHex('--border-subtle')
}
