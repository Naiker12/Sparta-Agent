import { useRef, useCallback } from 'react'
import type { editor as MonacoEditorNS } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import { useEventBusListener } from '@/hooks/useEventBus'

export function useInlineDiffDecorations(editorRef: React.RefObject<MonacoEditorNS.IStandaloneCodeEditor | null>) {
  const decorationsRef = useRef<string[]>([])

  const computeLineDiff = useCallback((original: string, modified: string) => {
    const origLines = original.split('\n')
    const modLines = modified.split('\n')
    const changedOrigLines = new Set<number>()
    const maxLen = Math.max(origLines.length, modLines.length)
    for (let i = 0; i < maxLen; i++) {
      if (origLines[i] !== modLines[i]) changedOrigLines.add(i + 1)
    }
    return changedOrigLines
  }, [])

  const apply = useCallback((filePath: string, original: string, modified: string) => {
    const ed = editorRef.current
    if (!ed) return
    const model = ed.getModel()
    if (!model || model.uri.fsPath.replace(/\\/g, '/') !== filePath.replace(/\\/g, '/')) return

    decorationsRef.current = ed.deltaDecorations(decorationsRef.current, [])

    const changedLines = computeLineDiff(original, modified)
    if (changedLines.size === 0) return

    const sorted = Array.from(changedLines).sort((a, b) => a - b)
    const ranges: { start: number; end: number }[] = []
    let rangeStart = sorted[0]
    let rangeEnd = sorted[0]
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === rangeEnd + 1) {
        rangeEnd = sorted[i]
      } else {
        ranges.push({ start: rangeStart, end: rangeEnd })
        rangeStart = sorted[i]
        rangeEnd = sorted[i]
      }
    }
    ranges.push({ start: rangeStart, end: rangeEnd })

    const newDecorations: MonacoEditorNS.IModelDeltaDecoration[] = ranges.map(({ start, end }) => ({
      range: new monaco.Range(start, 1, end, model.getLineMaxColumn(end)),
      options: {
        isWholeLine: true,
        className: 'inline-diff-highlight',
        overviewRuler: {
          color: 'rgba(234, 179, 8, 0.6)',
          position: monaco.editor.OverviewRulerLane.Right,
        },
        glyphMarginClassName: 'inline-diff-glyph',
      },
    }))

    decorationsRef.current = ed.deltaDecorations([], newDecorations)
  }, [editorRef, computeLineDiff])

  const clear = useCallback(() => {
    const ed = editorRef.current
    if (ed && decorationsRef.current.length > 0) {
      decorationsRef.current = ed.deltaDecorations(decorationsRef.current, [])
    }
  }, [editorRef])

  useEventBusListener('editor:diff_resolved', () => {
    clear()
  })

  return { applyInlineDiffDecorations: apply, clearInlineDiffDecorations: clear }
}
