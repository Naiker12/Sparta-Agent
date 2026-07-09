"use client"

import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useThemeStore, isDarkTheme } from '@/stores/theme.store'
import { getLanguageFromPath } from '@/lib/language-from-path'

interface MonacoEditorProps {
  path?: string
  content?: string
  onChange?: (value: string) => void
  onMount?: (editor: editor.IStandaloneCodeEditor) => void
}

export function MonacoEditor({ path, content, onChange, onMount }: MonacoEditorProps) {
  const { theme } = useThemeStore()
  const language = path ? getLanguageFromPath(path) : 'plaintext'
  const monacoTheme = isDarkTheme(theme) ? 'vs-dark' : 'vs'

  return (
    <Editor
      path={path ?? '__empty__'}
      defaultLanguage={language}
      value={content ?? ''}
      onChange={(val) => onChange?.(val ?? '')}
      onMount={onMount}
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
      }}
    />
  )
}
