import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// Vite worker imports — Vite bundles these from node_modules and serves
// them with the correct MIME type via blob URLs.
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

loader.config({ monaco })

;(window as any).MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'json':
        return new JsonWorker()
      case 'javascript':
      case 'typescript':
        return new TsWorker()
      default:
        return new EditorWorker()
    }
  },
}
