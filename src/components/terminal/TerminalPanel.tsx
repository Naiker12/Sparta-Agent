import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useThemeStore } from '@/stores/theme.store'
import { FEATURES } from '@/lib/env-adapter'
import { generateId, cn } from '@/lib/utils'
import { getXtermTheme } from '@/lib/xterm-theme'
import { Plus, X } from 'lucide-react'
import { useUIStore } from '@/stores/ui.store'
import '@xterm/xterm/css/xterm.css'

const TERMINAL_ID = generateId()

export function TerminalPanel() {
  if (!FEATURES.terminal) {
    return null
  }
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])
  const initDone = useRef(false)
  const { theme } = useThemeStore()
  const [isConnected, setIsConnected] = useState(false)
  const [shell, setShell] = useState<string>('')

  useEffect(() => {
    if (!containerRef.current || initDone.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: '"Geist Mono Variable", "Cascadia Code", "Fira Code", monospace',
      fontWeight: '400',
      lineHeight: 1.4,
      letterSpacing: 0,
      scrollback: 5000,
      theme: getXtermTheme(),
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const container = containerRef.current

    function doInit() {
      if (initDone.current) return
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        requestAnimationFrame(doInit)
        return
      }
      initDone.current = true
      terminal.open(container)
      requestAnimationFrame(() => {
        fitAddon.fit()
        initPTY(terminal)
      })
    }
    requestAnimationFrame(doInit)

    // Persistent ResizeObserver — keeps terminal sized correctly on panel resize
    const ro = new ResizeObserver(() => {
      if (initDone.current) {
        try { fitAddon.fit() } catch { /* xterm not ready yet */ }
      }
    })
    ro.observe(container)
    cleanupRef.current.push(() => ro.disconnect())

    return () => {
      initDone.current = false
      cleanupRef.current.forEach(fn => fn())
      cleanupRef.current = []
      window.terminal?.destroy(TERMINAL_ID)
      terminal.dispose()
    }
  }, [])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = getXtermTheme()
    }
  }, [theme])

  async function initPTY(terminal: Terminal) {
    const { cols, rows } = terminal

    // Register data listener BEFORE create() so we catch the banner + early PTY data
    const unsubData = window.terminal.onData(TERMINAL_ID, (data) => {
      terminal.write(data)
    })
    cleanupRef.current.push(unsubData)

    let result: { success: boolean; shell: string; error?: string }
    try {
      result = await window.terminal.create({
        terminalId: TERMINAL_ID,
        cols,
        rows,
      })
    } catch (err) {
      terminal.writeln('\r\n\x1b[31mError: No se pudo iniciar el shell\x1b[0m')
      terminal.writeln(`\x1b[90m${err instanceof Error ? err.message : String(err)}\x1b[0m`)
      return
    }

    if (!result.success) {
      terminal.writeln('\r\n\x1b[31mError: No se pudo iniciar el shell\x1b[0m')
      if (result.error) {
        terminal.writeln(`\x1b[90m${result.error}\x1b[0m`)
      }
      return
    }

    setIsConnected(true)
    setShell(result.shell)

    const unsubExit = window.terminal.onExit(TERMINAL_ID, (code) => {
      setIsConnected(false)
      terminal.writeln(`\r\n\x1b[33mProceso terminado (código: ${code})\x1b[0m`)
      terminal.writeln('\x1b[90mPresiona cualquier tecla para iniciar una nueva sesión\x1b[0m')
    })
    cleanupRef.current.push(unsubExit)

    terminal.onData((data) => {
      window.terminal.write(TERMINAL_ID, data)
    })

    terminal.onResize(({ cols, rows }) => {
      window.terminal.resize(TERMINAL_ID, cols, rows)
    })

    // Signal main process that listeners are registered (flushes buffered early data)
    window.electron.send('terminal:ready', { terminalId: TERMINAL_ID })
  }

  async function handleNewSession() {
    await window.terminal?.destroy(TERMINAL_ID)
    setIsConnected(false)
    setShell('')
    if (terminalRef.current) {
      terminalRef.current.reset()
      await initPTY(terminalRef.current)
    }
  }

  return (
    <div className="terminal-panel">
      <TerminalHeader shell={shell} isConnected={isConnected} onNewSession={handleNewSession} />
      <div
        ref={containerRef}
        className="terminal-container"
      />
    </div>
  )
}

function TerminalHeader({ shell, isConnected, onNewSession }: { shell: string; isConnected: boolean; onNewSession: () => void }) {
  const toggleTerminal = useUIStore((s) => s.toggleTerminal)

  return (
    <div className="terminal-header">
      <div className="terminal-header-left">
        <span className={cn(
          "terminal-status-dot",
          isConnected ? "bg-green-400" : "bg-gray-500"
        )} />
        <span className="terminal-shell-label">
          {shell ? shell.split('\\').pop()?.split('/').pop() ?? shell : 'Terminal'}
        </span>
      </div>
      <div className="terminal-header-actions">
        <button
          className="terminal-action-btn"
          title="Nueva sesión"
          onClick={onNewSession}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          className="terminal-action-btn"
          onClick={toggleTerminal}
          title="Cerrar terminal"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
