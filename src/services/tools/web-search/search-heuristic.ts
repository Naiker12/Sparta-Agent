const searchPatterns = [
  /\b(hoy|ayer|esta semana|este mes|este año|ahora|actual|último|reciente|en tiempo real)\b/i,
  /\b(precio|costo|cuánto cuesta|weather|clima|temperatura|pronóstico)\b/i,
  /\b(quién es|qué es|cuándo|dónde|cómo funciona|cuántos|cuántas)\b/i,
  /\b(news|noticias|evento|sucedió|pasó|resultado|ganó|elecciones)\b/i,
]

const noSearchPatterns = [
  /^(hola|hi|hello|hey|gracias|thanks|ok|sí|no|bien|adiós|chao)\b/i,
  /^(que|qué) (eres|puedes|haces|sabes|tal|onda)/i,
  /^explica|^resume|^traduce|^corrige/i,
]

export function shouldSearch(query: string): boolean {
  const trimmed = query.trim()
  if (noSearchPatterns.some((p) => p.test(trimmed))) return false
  return searchPatterns.some((p) => p.test(trimmed))
}
