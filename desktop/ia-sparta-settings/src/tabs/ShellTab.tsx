import { ShellProgramSection } from './shell/sections/ShellProgramSection'
import { ShellFlagsSection } from './shell/sections/ShellFlagsSection'
import { EnvVariablesSection } from './shell/sections/EnvVariablesSection'

export function ShellTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Intérprete de Comandos & Shell */}
      <ShellProgramSection />

      {/* 2. Banderas & Argumentos de Inicio */}
      <ShellFlagsSection />

      {/* 3. Variables de Entorno */}
      <EnvVariablesSection />
    </div>
  )
}
