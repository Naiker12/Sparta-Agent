import { ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const DB_PATH = path.join(process.env.APP_ROOT ?? '.', 'sparta-memory.json')

interface MemoryRow {
  id: string
  content: string
  source: string
  category: string | null
  createdAt: number
  projectId: string | null
  sourceSessionId: string | null
  sourceMessageId: string | null
}

interface RelationRow {
  fromId: string
  toId: string
  type: string
  weight: number
  entityType: string | null
}

function readDB(): { entries: MemoryRow[]; relations: RelationRow[] } {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { entries: [], relations: [] }
  }
}

function writeDB(data: { entries: MemoryRow[]; relations: RelationRow[] }) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export function registerMemoryIPC() {
  ipcMain.handle('memory:list', () => {
    return readDB()
  })

  ipcMain.handle('memory:addEntry', (_event, entry: MemoryRow) => {
    const db = readDB()
    db.entries.push(entry)
    writeDB(db)
    return entry.id
  })

  ipcMain.handle('memory:updateEntry', (_event, id: string, partial: Partial<MemoryRow>) => {
    const db = readDB()
    db.entries = db.entries.map((e) => (e.id === id ? { ...e, ...partial } : e))
    writeDB(db)
  })

  ipcMain.handle('memory:deleteEntry', (_event, id: string) => {
    const db = readDB()
    db.entries = db.entries.filter((e) => e.id !== id)
    db.relations = db.relations.filter((r) => r.fromId !== id && r.toId !== id)
    writeDB(db)
  })

  ipcMain.handle('memory:addRelation', (_event, rel: RelationRow) => {
    const db = readDB()
    db.relations.push(rel)
    writeDB(db)
  })

  ipcMain.handle('memory:updateRelation', (_event, fromId: string, toId: string, partial: Partial<RelationRow>) => {
    const db = readDB()
    db.relations = db.relations.map((r) =>
      r.fromId === fromId && r.toId === toId ? { ...r, ...partial } : r
    )
    writeDB(db)
  })

  ipcMain.handle('memory:removeRelation', (_event, fromId: string, toId: string) => {
    const db = readDB()
    db.relations = db.relations.filter((r) => r.fromId !== fromId || r.toId !== toId)
    writeDB(db)
  })
}
