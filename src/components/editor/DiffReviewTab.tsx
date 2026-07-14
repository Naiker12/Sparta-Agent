"use client"

import { useState } from 'react'
import DiffEditor from '@monaco-editor/react'
import { Check, X, ChevronRight, FileCode } from 'lucide-react'
import { useDiffReviewStore } from '@/stores/diff-review.store'
import { useEventBus } from '@/stores/event-bus.store'
import { useThemeStore, isDarkTheme } from '@/stores/theme.store'
import { getLanguageFromPath } from '@/lib/language-from-path'

/**
 * DiffReviewTab — inline DiffEditor that replaces the old modal.
 * Shows a Monaco <DiffEditor /> with real Myers diffing, plus an
 * approve/reject bar at the top. Multiple pending proposals are queued
 * (fixes bug 1.1 where 2 parallel tool calls would overwrite each other).
 */
export function DiffReviewTab() {
  const { activeProposal, queue, resolve, next } = useDiffReviewStore()
  const dispatch = useEventBus((s) => s.dispatch)
  const { theme } = useThemeStore()
  const monacoTheme = isDarkTheme(theme) ? 'vs-dark' : 'vs'
  const [submitting, setSubmitting] = useState(false)

  if (!activeProposal) return null

  const { requestId, filePath, originalContent, newContent, language } = activeProposal
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath
  const pendingCount = queue.filter((q) => q.status === 'pending').length
  const currentIndex = queue.findIndex((q) => q.requestId === requestId)
  const resolvedIndex = queue.findIndex(
    (q) => q.status === 'approved' || q.status === 'rejected'
  )
  // Queue position for display
  const pos = queue.filter((q, i) => i <= currentIndex && q.status === 'pending').length

  const handleRespond = async (approved: boolean) => {
    setSubmitting(true)
    try {
      await window.editorBridge?.respondDiff({ requestId, approved })
      resolve(requestId, approved)

      // Notify listeners (e.g. inline diff decorations) that the diff was resolved
      dispatch({
        type: 'editor:diff_resolved',
        filePath,
        approved,
        timestamp: Date.now(),
      } as any)

      if (approved) {
        // Open/activate the file so user sees the result
        dispatch({
          type: 'editor:open_file',
          filePath,
          timestamp: Date.now(),
        } as any)
      }

      // Auto-advance to next pending
      next()
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    next()
  }

  return (
    <div
      className="diff-review-tab"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--bg-base)',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            color: 'var(--accent)',
          }}
        >
          <FileCode size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Revisar cambio propuesto
            {pendingCount > 1 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>
                ({pos}/{pendingCount})
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fileName}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {pendingCount > 1 && (
            <button
              onClick={handleSkip}
              disabled={submitting}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                fontSize: 11, fontFamily: 'var(--font-ui)',
                background: 'transparent', border: '1px solid var(--border-normal)',
                color: 'var(--text-secondary)',
              }}
              title="Saltar al siguiente pendiente"
            >
              <ChevronRight size={12} />
              Saltar
            </button>
          )}
          <button
            onClick={() => handleRespond(false)}
            disabled={submitting}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
              fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
              background: 'transparent', border: '1px solid var(--border-normal)',
              color: 'var(--status-err)',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            <X size={13} />
            Rechazar
          </button>
          <button
            onClick={() => handleRespond(true)}
            disabled={submitting}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
              fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
              background: 'var(--accent)', border: '1px solid var(--accent)',
              color: '#fff',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            <Check size={13} />
            Aceptar
          </button>
        </div>
      </div>

      {/* Monaco DiffEditor — real Myers diff, replaces line-by-line fake diff */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <DiffEditor
          {...({
            original: originalContent,
            modified: newContent,
            language: getLanguageFromPath(filePath) || language || 'plaintext',
            theme: monacoTheme,
            options: {
              renderSideBySide: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'Geist Mono Variable, monospace',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 8 },
              readOnly: true,
              originalEditable: false,
              diffWordWrap: 'off',
            },
          } as any)}
        />
      </div>
    </div>
  )
}
