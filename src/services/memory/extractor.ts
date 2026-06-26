import type { ExtractedMemory } from '@/interfaces/memory.interface'

const EXTRACTION_PROMPT = `Analiza el siguiente turno de conversación (usuario + asistente) y extrae:
1. ENTIDADES: nombres propios, tecnologías, conceptos clave mencionados
2. HECHOS: afirmaciones concretas sobre las entidades (una por línea, en texto plano)
3. RELACIONES: conexiones entre entidades

Responde ÚNICAMENTE con JSON válido en este formato exacto, sin texto adicional:
{
  "entities": [{ "name": "...", "category": "..." }],
  "facts": [{ "content": "...", "aboutEntity": "..." }],
  "relations": [{ "from": "...", "to": "...", "type": "...", "weight": 0.5 }]
}

Donde category puede ser: technology, person, concept, tool, project, language
Donde type puede ser: uses, depends_on, related_to, implements, part_of
Weight debe ser un número entre 0.1 y 1.0 según qué tan fuerte sea la relación.

Turno de conversación:
---`

const TRIVIAL_PATTERNS = [
  /^(hola|hey|hi|hello|buenos días|buenas|qué tal|ok|gracias|bye|chao|adiós)\b/i,
  /^sí\b/i,
  /^no\b/i,
  /^:\s*\)/,
]

export function isTrivialTurn(text: string): boolean {
  return TRIVIAL_PATTERNS.some((p) => p.test(text.trim()))
}

export function buildExtractionPrompt(userMessage: string, assistantResponse: string): string {
  return `${EXTRACTION_PROMPT}
Usuario: ${userMessage}
Asistente: ${assistantResponse}`
}

function extractJSON(raw: string): string {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON found in LLM response')
  return cleaned.slice(start, end + 1)
}

export function parseExtractionResponse(raw: string): ExtractedMemory {
  try {
    const json = extractJSON(raw)
    const parsed = JSON.parse(json)
    return {
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      relations: Array.isArray(parsed.relations) ? parsed.relations : [],
    }
  } catch (err) {
    console.warn('[memory:extractor] Failed to parse LLM response:', (err as Error).message)
    console.warn('[memory:extractor] Raw response (first 300 chars):', raw.slice(0, 300))
    return { entities: [], facts: [], relations: [] }
  }
}

export async function extractMemory(
  userMessage: string,
  assistantResponse: string,
  llmCall: (prompt: string) => Promise<string>
): Promise<ExtractedMemory> {
  if (isTrivialTurn(userMessage)) {
    console.debug('[memory:extractor] Skipping trivial turn:', userMessage.trim().slice(0, 50))
    return { entities: [], facts: [], relations: [] }
  }
  const prompt = buildExtractionPrompt(userMessage, assistantResponse)
  console.debug('[memory:extractor] Calling LLM for extraction...')
  try {
    const raw = await llmCall(prompt)
    console.debug('[memory:extractor] LLM responded, parsing...')
    const result = parseExtractionResponse(raw)
    console.debug(`[memory:extractor] Parsed: ${result.entities.length} entities, ${result.facts.length} facts, ${result.relations.length} relations`)
    return result
  } catch (err) {
    console.error('[memory:extractor] LLM call failed:', (err as Error).message)
    return { entities: [], facts: [], relations: [] }
  }
}
