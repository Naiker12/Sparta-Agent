import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// Use the locally installed monaco-editor package instead of fetching from CDN.
// This removes the runtime dependency on cdn.jsdelivr.net and makes the editor
// work fully offline.
loader.config({ monaco })

// Configure Monaco web workers to also come from the local bundle.
;(window as any).MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case 'css':
      case 'scss':
      case 'less':
        return new Worker(
          new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url),
          { type: 'module' },
        )
      case 'html':
      case 'handlebars':
      case 'razor':
        return new Worker(
          new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url),
          { type: 'module' },
        )
      case 'json':
        return new Worker(
          new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url),
          { type: 'module' },
        )
      case 'javascript':
      case 'typescript':
        return new Worker(
          new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url),
          { type: 'module' },
        )
      default:
        return new Worker(
          new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url),
          { type: 'module' },
        )
    }
  },
}
