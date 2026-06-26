import { describe, it, expect } from 'vitest'
import { isTrivialTurn, buildExtractionPrompt, parseExtractionResponse } from '../extractor'

describe('extractor', () => {
  describe('isTrivialTurn', () => {
    it('detecta "hola" como trivial', () => {
      expect(isTrivialTurn('hola')).toBe(true)
    })

    it('detecta saludos variados como triviales', () => {
      expect(isTrivialTurn('Hola, ¿cómo estás?')).toBe(true)
      expect(isTrivialTurn('hey')).toBe(true)
      expect(isTrivialTurn('Buenos días')).toBe(true)
      expect(isTrivialTurn('gracias')).toBe(true)
    })

    it('NO detecta mensajes con datos como triviales', () => {
      expect(isTrivialTurn('Me llamo Carlos y trabajo en una fintech en Bogotá')).toBe(false)
      expect(isTrivialTurn('Uso React y Node.js para mis proyectos')).toBe(false)
    })
  })

  describe('buildExtractionPrompt', () => {
    it('construye el prompt con user y assistant', () => {
      const prompt = buildExtractionPrompt('Hola', '¡Hola! ¿En qué puedo ayudarte?')
      expect(prompt).toContain('Usuario: Hola')
      expect(prompt).toContain('Asistente: ¡Hola! ¿En qué puedo ayudarte?')
    })
  })

  describe('parseExtractionResponse', () => {
    it('parsea JSON puro correctamente', () => {
      const result = parseExtractionResponse(`{"entities":[{"name":"Carlos","category":"person"}],"facts":[{"content":"Trabaja en fintech","aboutEntity":"Carlos"}],"relations":[]}`)
      expect(result.entities).toHaveLength(1)
      expect(result.entities[0].name).toBe('Carlos')
      expect(result.facts).toHaveLength(1)
      expect(result.facts[0].content).toBe('Trabaja en fintech')
    })

    it('parsea JSON envuelto en markdown ```json', () => {
      const raw = '```json\n{"entities":[{"name":"React","category":"technology"}],"facts":[],"relations":[]}\n```'
      const result = parseExtractionResponse(raw)
      expect(result.entities).toHaveLength(1)
      expect(result.entities[0].name).toBe('React')
    })

    it('parsea JSON con texto adicional antes/después', () => {
      const raw = 'Aquí está el análisis:\n{"entities":[{"name":"Node.js","category":"technology"}],"facts":[{"content":"Usa Node.js para backend","aboutEntity":"Node.js"}],"relations":[]}\nFin del análisis.'
      const result = parseExtractionResponse(raw)
      expect(result.entities).toHaveLength(1)
      expect(result.facts).toHaveLength(1)
    })

    it('retorna arrays vacíos si no hay entidades ni facts', () => {
      const result = parseExtractionResponse('{"entities":[],"facts":[],"relations":[]}')
      expect(result.entities).toHaveLength(0)
      expect(result.facts).toHaveLength(0)
    })

    it('retorna arrays vacíos para JSON inválido', () => {
      const result = parseExtractionResponse('esto no es json')
      expect(result.entities).toHaveLength(0)
      expect(result.facts).toHaveLength(0)
    })

    it('retorna arrays vacíos para respuesta vacía', () => {
      const result = parseExtractionResponse('')
      expect(result.entities).toHaveLength(0)
      expect(result.facts).toHaveLength(0)
    })

    it('tolera campos faltantes en el JSON', () => {
      const result = parseExtractionResponse('{"entities":[{"name":"Python","category":"language"}]}')
      expect(result.entities).toHaveLength(1)
      expect(result.facts).toHaveLength(0)
      expect(result.relations).toHaveLength(0)
    })

    it('extrae entidades de un mensaje con datos personales claros', () => {
      const json = {
        entities: [
          { name: 'Carlos', category: 'person' },
          { name: 'Bogotá', category: 'concept' },
          { name: 'fintech', category: 'concept' },
        ],
        facts: [
          { content: 'Carlos trabaja en una fintech', aboutEntity: 'Carlos' },
          { content: 'Carlos vive en Bogotá', aboutEntity: 'Carlos' },
        ],
        relations: [
          { from: 'Carlos', to: 'Bogotá', type: 'related_to', weight: 0.8 },
        ],
      }
      const result = parseExtractionResponse(JSON.stringify(json))
      expect(result.entities).toHaveLength(3)
      expect(result.facts).toHaveLength(2)
      expect(result.relations).toHaveLength(1)
    })
  })
})
