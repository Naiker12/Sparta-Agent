/**
 * chart-storage.ts
 * Gestor de persistencia en disco y rotación de archivos HTML para gráficas.
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export async function saveChartHtml(title: string, htmlContent: string): Promise<string> {
  const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
  const fileName = `chart-${sanitizedTitle || 'data'}-${Date.now()}.html`
  const baseDir = typeof app?.getPath === 'function' ? app.getPath('userData') : process.cwd()
  const chartsDir = path.join(baseDir, 'sparta', 'charts')
  const filePath = path.join(chartsDir, fileName)

  await fs.promises.mkdir(chartsDir, { recursive: true })
  await fs.promises.writeFile(filePath, htmlContent, 'utf-8')
  cleanupOldCharts(chartsDir).catch(() => {})

  return filePath
}

async function cleanupOldCharts(chartsDir: string) {
  try {
    const files = await fs.promises.readdir(chartsDir)
    if (files.length <= 50) return
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const p = path.join(chartsDir, file)
        const stat = await fs.promises.stat(p)
        return { path: p, mtime: stat.mtimeMs }
      })
    )
    fileStats.sort((a, b) => a.mtime - b.mtime)
    const toDelete = fileStats.slice(0, fileStats.length - 40)
    for (const f of toDelete) {
      await fs.promises.unlink(f.path).catch(() => {})
    }
  } catch {
    /* ignore cleanup errors */
  }
}
