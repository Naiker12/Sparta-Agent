/** Convierte texto Markdown plano en objetos rich_text con anotaciones de Notion */
export function markdownToRichText(text: string): Array<{ type: 'text'; text: { content: string }; annotations?: { bold?: boolean; italic?: boolean; code?: boolean } }> {
  const parts: Array<{ type: 'text'; text: { content: string }; annotations?: { bold?: boolean; italic?: boolean; code?: boolean } }> = []
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|[^*`]+)/g
  const matches = text.match(regex) || [text]

  for (const m of matches) {
    if (m.startsWith('**') && m.endsWith('**')) {
      parts.push({ type: 'text', text: { content: m.slice(2, -2) }, annotations: { bold: true } })
    } else if (m.startsWith('*') && m.endsWith('*')) {
      parts.push({ type: 'text', text: { content: m.slice(1, -1) }, annotations: { italic: true } })
    } else if (m.startsWith('`') && m.endsWith('`')) {
      parts.push({ type: 'text', text: { content: m.slice(1, -1) }, annotations: { code: true } })
    } else {
      parts.push({ type: 'text', text: { content: m } })
    }
  }
  return parts.length > 0 ? parts : [{ type: 'text', text: { content: text } }]
}

/** Convierte una cadena de texto Markdown en bloques nativos de Notion */
export function markdownToNotionBlocks(text: string): any[] {
  const lines = text.split('\n')
  const blocks: any[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: markdownToRichText(trimmed.slice(2)) },
      })
    } else if (trimmed.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: markdownToRichText(trimmed.slice(3)) },
      })
    } else if (trimmed.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: markdownToRichText(trimmed.slice(4)) },
      })
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: markdownToRichText(trimmed.slice(2)) },
      })
    } else if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s/, '')
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: markdownToRichText(content) },
      })
    } else if (trimmed.startsWith('> ')) {
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: { rich_text: markdownToRichText(trimmed.slice(2)) },
      })
    } else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: markdownToRichText(trimmed) },
      })
    }
  }

  return blocks.length > 0 ? blocks : [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
    },
  ]
}
