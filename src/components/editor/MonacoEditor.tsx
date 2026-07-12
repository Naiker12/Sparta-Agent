"use client"

import { useEffect, useRef, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { KeyMod, KeyCode } from 'monaco-editor'
import { useThemeStore, isDarkTheme } from '@/stores/theme.store'
import { getLanguageFromPath } from '@/lib/language-from-path'

interface MonacoEditorProps {
  path?: string
  content?: string
  onChange?: (value: string) => void
  onMount?: (editor: editor.IStandaloneCodeEditor) => void
  /** Callback when user triggers inline ask (Cmd+K or context menu) */
  onInlineAsk?: (selection: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }, selectedText: string) => void
}

export function MonacoEditor({ path, content, onChange, onMount, onInlineAsk }: MonacoEditorProps) {
  const { theme } = useThemeStore()
  const language = path ? getLanguageFromPath(path) : 'plaintext'
  const monacoTheme = isDarkTheme(theme) ? 'vs-dark' : 'vs'
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleMount = useCallback((ed: editor.IStandaloneCodeEditor) => {
    editorRef.current = ed
    onMount?.(ed)

    // Add context menu actions: Explicar / Arreglar / Refactorizar
    ed.addAction({
      id: 'explain-selection',
      label: 'Explicar esta selección',
      keybindings: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyE],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1,
      run: () => {
        const selection = ed.getSelection()
        const selectedText = ed.getModel()?.getValueInRange(selection as any) ?? ''
        if (selection && selectedText && onInlineAsk) {
          onInlineAsk(
            { startLineNumber: selection.startLineNumber, startColumn: selection.startColumn, endLineNumber: selection.endLineNumber, endColumn: selection.endColumn },
            selectedText
          )
        }
      },
    })

    ed.addAction({
      id: 'fix-selection',
      label: 'Arreglar esta selección',
      keybindings: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 2,
      run: () => {
        const selection = ed.getSelection()
        const selectedText = ed.getModel()?.getValueInRange(selection as any) ?? ''
        if (selection && selectedText && onInlineAsk) {
          onInlineAsk(
            { startLineNumber: selection.startLineNumber, startColumn: selection.startColumn, endLineNumber: selection.endLineNumber, endColumn: selection.endColumn },
            selectedText
          )
        }
      },
    })

    ed.addAction({
      id: 'refactor-selection',
      label: 'Refactorizar esta selección',
      keybindings: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 3,
      run: () => {
        const selection = ed.getSelection()
        const selectedText = ed.getModel()?.getValueInRange(selection as any) ?? ''
        if (selection && selectedText && onInlineAsk) {
          onInlineAsk(
            { startLineNumber: selection.startLineNumber, startColumn: selection.startColumn, endLineNumber: selection.endLineNumber, endColumn: selection.endColumn },
            selectedText
          )
        }
      },
    })

    // Add Cmd+K shortcut for inline ask
    ed.addCommand(KeyMod.CtrlCmd | KeyCode.KeyK, () => {
      const selection = ed.getSelection()
      const selectedText = ed.getModel()?.getValueInRange(selection as any) ?? ''
      if (selection && selectedText && onInlineAsk) {
        onInlineAsk(
          { startLineNumber: selection.startLineNumber, startColumn: selection.startColumn, endLineNumber: selection.endLineNumber, endColumn: selection.endColumn },
          selectedText
        )
      }
    })
  }, [onMount, onInlineAsk])

  // Cleanup actions on unmount
  useEffect(() => {
    return () => {
      editorRef.current?.dispose()
    }
  }, [])

  return (
    <Editor
      path={path ?? '__empty__'}
      defaultLanguage={language}
      value={content ?? ''}
      onChange={(val) => onChange?.(val ?? '')}
      onMount={handleMount}
      theme={monacoTheme}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: 'Geist Mono Variable, monospace',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12 },
        readOnly: !path,
        contextmenu: true,
      }}
    />
  )
}
