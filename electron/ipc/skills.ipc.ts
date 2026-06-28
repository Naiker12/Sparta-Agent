import { ipcMain, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'


const SKILLS_LIB_REL = path.join('sparta_ai', 'skills_library')
const USER_SKILLS_REL = path.join('sparta', 'skills')

function getBuiltinSkillsDir(): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(process.cwd(), 'python')
  return path.join(base, SKILLS_LIB_REL)
}

function getUserSkillsDir(): string {
  return path.join(app.getPath('userData'), USER_SKILLS_REL)
}

function findAllSkillDirs(root: string): string[] {
  const dirs: string[] = []
  if (!fs.existsSync(root)) return dirs
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    // Could be a category dir or a skill dir directly
    const full = path.join(root, entry.name)
    if (fs.existsSync(path.join(full, 'SKILL.md'))) {
      dirs.push(full)
    } else {
      // Check if subdirs contain SKILL.md
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

function readManifest(skillsDir: string): unknown[] {
  const manifestPath = path.join(skillsDir, '.manifest.json')
  if (fs.existsSync(manifestPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      return data.skills || []
    } catch { /* ignore */ }
  }
  return []
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

function parseFrontmatter(text: string): Record<string, unknown> {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return {}
  const meta: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    let key = line.slice(0, idx).trim()
    let val: unknown = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (val === 'true') val = true
    else if (val === 'false') val = false
    // Parse tags from [tag1, tag2]
    if (key === 'tags' && typeof val === 'string' && val.startsWith('[')) {
      val = val.replace(/[\[\]]/g, '').split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean)
    }
    meta[key] = val
  }
  return meta
}

function readSkillMd(skillId: string): { metadata: Record<string, unknown>; body: string; source_path: string } | null {
  const builtinDir = getBuiltinSkillsDir()
  const userDir = getUserSkillsDir()
  const searchRoots = [userDir, builtinDir]
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
  return null
}

export function registerSkillsIPC(): void {
  // List all available skills (merged from builtin + user)
  ipcMain.handle('skills:list', async () => {
    const seen = new Set<string>()
    const result: unknown[] = []

    // User-installed skills first (take priority)
    const userDir = getUserSkillsDir()
    const userManifest = readManifest(userDir)
    const userScanned = userManifest.length ? userManifest : scanDirForSkills(userDir, 'user')
    for (const skill of userScanned) {
      const s = skill as Record<string, unknown>
      if (s.id && !seen.has(String(s.id))) {
        seen.add(String(s.id))
        result.push(s)
      }
    }

    // Builtin skills
    const builtinDir = getBuiltinSkillsDir()
    const builtinManifest = readManifest(builtinDir)
    const builtinScanned = builtinManifest.length ? builtinManifest : scanDirForSkills(builtinDir, 'builtin')
    for (const skill of builtinScanned) {
      const s = skill as Record<string, unknown>
      if (s.id && !seen.has(String(s.id))) {
        seen.add(String(s.id))
        result.push(s)
      }
    }

    return result
  })

  // View full skill content
  ipcMain.handle('skills:view', async (_event, skillId: string) => {
    const result = readSkillMd(skillId)
    if (result) return result
    return { metadata: { id: skillId }, body: '', source_path: '' }
  })

  // Uninstall a user skill
  ipcMain.handle('skills:uninstall', async (_event, skillId: string) => {
    const userDir = getUserSkillsDir()
    for (const dir of findAllSkillDirs(userDir)) {
      if (path.basename(dir) === skillId) {
        fs.rmSync(dir, { recursive: true, force: true })
        return { success: true }
      }
    }
    return { success: false, error: `Skill '${skillId}' not found in user directory` }
  })

  // Install skill from a URL (downloads tarball or raw SKILL.md)
  ipcMain.handle('skills:installFromUrl', async (_event, url: string) => {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }
      const content = await response.text()

      // Parse frontmatter to get skill id
      const meta = parseFrontmatter(content)
      const skillId = String(meta.id || crypto.randomUUID())

      // Security scan
      const scanResult = scanSkillContent(content)
      if (!scanResult.passed) {
        return {
          success: false,
          error: `Security scan failed: ${scanResult.warnings.join('; ')}`,
          scan: scanResult,
        }
      }

      // Write to user skills dir
      const userDir = getUserSkillsDir()
      const skillDir = path.join(userDir, skillId)
      fs.mkdirSync(skillDir, { recursive: true })
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8')

      return { success: true, skillId, scan: scanResult }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // Install from a GitHub repo (downloads tarball)
  ipcMain.handle('skills:installFromRepo', async (_event, repoUrl: string) => {
    try {
      // Normalize GitHub URL
      let normalized = repoUrl.replace(/\.git$/, '').replace(/\/$/, '')
      if (normalized.includes('github.com')) {
        normalized = normalized + '/archive/main.tar.gz'
      }

      const response = await fetch(normalized)
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }

      // For now, simple tarball extraction isn't implemented in Node.js without deps
      // Return instructions
      return {
        success: false,
        error: 'Direct repo installation requires additional dependencies. Use URL to raw SKILL.md instead.',
        info: `Download from ${normalized} and extract manually to ${getUserSkillsDir()}`,
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}

function scanSkillContent(content: string): { passed: boolean; warnings: string[]; risk_score: number; risk_level: string } {
  const patterns: { id: string; pattern: RegExp; desc: string; severity: number }[] = [
    { id: 'exec_eval', pattern: /\b(exec|eval|compile|__import__)\s*\(/i, desc: 'Dynamic code execution', severity: 5 },
    { id: 'subprocess', pattern: /\b(subprocess|os\.system|os\.popen|shutil\.rmtree)\s*\./i, desc: 'Shell/process execution', severity: 5 },
    { id: 'path_traversal', pattern: /\.\.\/|\.\.\\\\/, desc: 'Path traversal', severity: 4 },
    { id: 'import_restricted', pattern: /^import\s+(os|subprocess|shutil|sys|ctypes)/im, desc: 'Restricted module import', severity: 4 },
  ]

  const warnings: string[] = []
  let riskScore = 0
  for (const p of patterns) {
    const matches = content.match(p.pattern)
    if (matches) {
      const count = matches.length
      warnings.push(`[${p.id}] ${p.desc} (${count} match(es))`)
      riskScore += Math.min(count, 5) * p.severity
    }
  }

  const maxScore = 100
  riskScore = Math.min(riskScore, maxScore)
  const riskLevel = riskScore === 0 ? 'low' : riskScore <= 30 ? 'medium' : riskScore <= 70 ? 'high' : 'critical'

  return {
    passed: !['high', 'critical'].includes(riskLevel),
    warnings,
    risk_score: riskScore,
    risk_level: riskLevel,
  }
}
