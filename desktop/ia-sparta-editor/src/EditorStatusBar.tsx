const LANG_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript React', js: 'JavaScript', jsx: 'JavaScript React',
  py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java',
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', json: 'JSON',
  yaml: 'YAML', yml: 'YAML', md: 'Markdown', sh: 'Shell', bash: 'Shell',
  xml: 'XML', toml: 'TOML', vue: 'Vue', svelte: 'Svelte',
}

export function StatusBar({ path, line, col }: { path: string; line: number; col: number }) {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const lang = LANG_MAP[ext] ?? (ext.toUpperCase() || 'Plain text')
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 12,
      padding: '2px 12px',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      fontSize: 10.5,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted)',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      <span>Ln {line}, Col {col}</span>
      <span>UTF-8</span>
      <span>{lang}</span>
    </div>
  )
}
