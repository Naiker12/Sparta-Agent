import { ipcMain, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'

// Skills live at <project-root>/skills/ — same location as Hermes, Vercel, Claude Code
const SKILLS_DIR_REL = 'skills'

function getSkillsDir(): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'python', '..')
    : process.cwd()
  return path.resolve(base, SKILLS_DIR_REL)
}

function getUserSkillsDir(): string {
  return path.join(app.getPath('userData'), 'sparta', 'skills')
}

function findAllSkillDirs(root: string): string[] {
  const dirs: string[] = []
  if (!fs.existsSync(root)) return dirs
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const full = path.join(root, entry.name)
    if (fs.existsSync(path.join(full, 'SKILL.md'))) {
      dirs.push(full)
    } else {
      for (const sub of fs.readdirSync(full, { withFileTypes: true })) {
        if (sub.isDirectory() && !sub.name.startsWith('.')) {
          const subFull = path.join(full, sub.name)
          if (fs.existsSync(path.join(subFull, 'SKILL.md'))) {
            dirs.push(subFull)
          }
        }
      }
    }
  }
  return dirs
}

function parseFrontmatter(text: string): Record<string, unknown> {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return {}
  const meta: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val: unknown = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (val === 'true') val = true
    else if (val === 'false') val = false
    if (key === 'tags' && typeof val === 'string' && val.startsWith('[')) {
      val = val.replace(/[\[\]]/g, '').split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean)
    }
    meta[key] = val
  }
  return meta
}

function scanDirForSkills(source: string, sourceLabel: string): unknown[] {
  const skills: unknown[] = []
  for (const skillDir of findAllSkillDirs(source)) {
    const mdPath = path.join(skillDir, 'SKILL.md')
    try {
      const content = fs.readFileSync(mdPath, 'utf-8')
      const meta = parseFrontmatter(content)
      if (meta.id) {
        skills.push({ ...meta, source: sourceLabel })
      }
    } catch { /* skip */ }
  }
  return skills
}

function runNpxSkills(args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc: any = spawn('npx', ['skills', ...args], {
      cwd: process.cwd(),
      shell: process.platform === 'win32',
    })
    let output = ''
    proc.stdout?.on('data', (d: Buffer) => (output += d.toString()))
    proc.stderr?.on('data', (d: Buffer) => (output += d.toString()))
    proc.on('close', (code: number | null) => resolve({ ok: code === 0, output }))
    proc.on('error', (err: Error) => resolve({ ok: false, output: err.message }))
  })
}

export function registerSkillsIPC(): void {
  ipcMain.handle('skills:list', async () => {
    const seen = new Set<string>()
    const result: unknown[] = []

    // User-installed skills (override)
    const userDir = getUserSkillsDir()
    for (const skill of scanDirForSkills(userDir, 'user')) {
      const s = skill as Record<string, unknown>
      if (s.id && !seen.has(String(s.id))) {
        seen.add(String(s.id))
        result.push(s)
      }
    }

    // Builtin + npx-installed from /skills/
    const skillsDir = getSkillsDir()
    for (const skill of scanDirForSkills(skillsDir, 'builtin')) {
      const s = skill as Record<string, unknown>
      if (s.id && !seen.has(String(s.id))) {
        seen.add(String(s.id))
        result.push(s)
      }
    }

    return result
  })

  ipcMain.handle('skills:view', async (_event, skillId: string) => {
    const skillsDir = getSkillsDir()
    const userDir = getUserSkillsDir()
    const searchRoots = [userDir, skillsDir]

    for (const root of searchRoots) {
      for (const dir of findAllSkillDirs(root)) {
        const mdPath = path.join(dir, 'SKILL.md')
        if (path.basename(dir) === skillId && fs.existsSync(mdPath)) {
          const content = fs.readFileSync(mdPath, 'utf-8')
          const meta = parseFrontmatter(content)
          const body = content.replace(/^---[\s\S]*?---\n*/, '').trim()
          return { metadata: meta, body, source_path: mdPath }
        }
      }
    }
    return { metadata: { id: skillId }, body: '', source_path: '' }
  })

  ipcMain.handle('skills:uninstall', async (_event, skillId: string) => {
    const skillsDir = getSkillsDir()
    for (const dir of findAllSkillDirs(skillsDir)) {
      if (path.basename(dir) === skillId) {
        fs.rmSync(dir, { recursive: true, force: true })
        return { success: true }
      }
    }
    return { success: false, error: `Skill '${skillId}' not found` }
  })

  // ── npx skills CLI integration ───────────────────────────────

  /** Install a skill from a GitHub repo using npx skills CLI */
  ipcMain.handle('skills:install', async (_event, { repo, skill }: { repo: string; skill?: string }) => {
    const args = ['add', repo]
    if (skill) args.push('--skill', skill)
    else args.push('--all')
    args.push('-y')

    return runNpxSkills(args)
  })

  /** List available skills in a repo without installing */
  ipcMain.handle('skills:repo-list', async (_event, repo: string) => {
    return runNpxSkills(['add', repo, '--list'])
  })

  /** Search skills.sh registry for skills */
  ipcMain.handle('skills:find', async (_event, query: string) => {
    return runNpxSkills(['find', query])
  })

  /** Update all installed skills */
  ipcMain.handle('skills:update', async () => {
    return runNpxSkills(['update'])
  })
}
