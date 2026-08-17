import { useRef, useEffect, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { FEATURES, IS_WEB } from 'ia-sparta-platform'
import { generateId, cn } from 'ia-sparta-core'
import { getXtermTheme } from 'ia-sparta-core'
import {
  Plus,
  ChevronDown,
  ChevronUp,
  RotateCw,
  MessageSquarePlus,
  Bot,
  Terminal as TerminalIcon,
  X,
  Activity,
} from 'lucide-react'
import { useUIStore } from 'ia-sparta-core'
import { useChatStore } from 'ia-sparta-core'
import { useTerminalStore } from 'ia-sparta-core'
import { useSettingsStore } from 'ia-sparta-core'
import { useFolderStore } from 'ia-sparta-core'
import { registerAgentTerminalWriter, seedAgentTerminalCommand, writeAgentTerminalChunk, clearAgentTerminal } from './agent-terminal-stream'
import { TERMINAL_PALETTE } from './theme'
import '@xterm/xterm/css/xterm.css'

interface TerminalInstance {
  terminal: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
  container: HTMLDivElement
  tabId: string
  ptyId: string
  connected: boolean
  shellName: string
  cleanups: (() => void)[]
}

interface SystemMetrics {
  cpuPercent: number
  memoryMb: number
}

function TerminalSelectionPopup({ style, onAddToChat, onClose }: { style: React.CSSProperties; onAddToChat: () => void; onClose: () => void }) {
  return (
    <div
      className="fixed z-50 flex items-center gap-1 px-1.5 py-1 rounded-lg shadow-lg"
      style={{
        ...style,
        background: TERMINAL_PALETTE.cardBg,
        border: `1px solid ${TERMINAL_PALETTE.border}`,
      }}
    >
      <button
        onClick={() => { onAddToChat(); onClose() }}
        className="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded hover:bg-[#313244] transition-colors"
        style={{ color: TERMINAL_PALETTE.textSecondary }}
        title="Agregar selección al chat"
      >
        <MessageSquarePlus className="w-3 h-3" />
        <span>Agregar al chat</span>
      </button>
      <button
        onClick={onClose}
        className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#313244] transition-colors"
        style={{ color: TERMINAL_PALETTE.textMuted }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

export function TerminalWorkspace() {
  const toggleTerminal = useUIStore((s) => s.toggleTerminal)
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const store = useTerminalStore

  const instancesRef = useRef<Map<string, TerminalInstance>>(new Map())
  const containersRef = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const [, forceRender] = useState(0)
  const fitTimerRef = useRef<number>(0)

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)

  useEffect(() => {
    store.getState().ensureAtLeastOneTab()
    if (!store.getState().activeTabId) {
      store.setState({ activeTabId: store.getState().tabs[0]?.id ?? null })
    }
  }, [])

  // Poll system metrics every 3 seconds if electron invoke is available
  useEffect(() => {
    let alive = true
    async function fetchMetrics() {
      try {
        if (typeof window !== 'undefined' && window.electron?.invoke) {
          const res = await window.electron.invoke('system:get-metrics') as any
          if (alive && res && typeof res.cpuPercent === 'number') {
            setMetrics({ cpuPercent: res.cpuPercent, memoryMb: res.memoryMb })
          }
        }
      } catch {
        /* ignore */
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 3000)
    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const settingsShell = useSettingsStore((s) => s.shellProgram)
  const [selectedProfile, setSelectedProfile] = useState<string>(settingsShell || '')
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const activeInstance = instancesRef.current.get(activeTabId ?? '')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchVisible((v) => !v)
      }
      if (e.key === 'Escape' && searchVisible) {
        setSearchVisible(false)
        activeInstance?.searchAddon.clearDecorations()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchVisible, activeInstance])

  function initUserPTY(inst: TerminalInstance, shellProfile?: string) {
    const terminal = inst.terminal
    const { cols, rows } = terminal

    if (typeof window === 'undefined' || !window.terminal || !window.terminal.onData) {
      terminal.writeln('\r\n\x1b[33mModo Web / Vista Previa: PTY nativo no disponible en esta ventana\x1b[0m')
      terminal.writeln('\x1b[90mAbre la aplicación de escritorio en Electron para usar la consola PTY nativa.\x1b[0m')
      return
    }

    const unsubData = window.terminal.onData(inst.ptyId, (data: string) => terminal.write(data))
    if (unsubData) inst.cleanups.push(unsubData)

    const settings = useSettingsStore.getState()
    const folderPath = useFolderStore.getState().connectedPath

    window.terminal.create({
      terminalId: inst.ptyId,
      cols,
      rows,
      shell: shellProfile || settings.shellProgram || undefined,
      shellFlags: settings.shellFlags,
      envOverrides: settings.envOverrides,
      cwd: folderPath || undefined,
    }).then((result) => {
      if (!result.success) {
        terminal.writeln('\r\n\x1b[31mError al iniciar shell\x1b[0m')
        if (result.error) terminal.writeln(`\x1b[90m${result.error}\x1b[0m`)
        return
      }

      inst.connected = true
      inst.shellName = result.shell ?? ''
      store.getState().reportShell(inst.tabId, result.shell ?? '')

      const unsubExit = window.terminal?.onExit?.(inst.ptyId, (code: number) => {
        inst.connected = false
        terminal.writeln(`\r\n\x1b[33mProceso terminado (código: ${code})\x1b[0m`)
      })
      if (unsubExit) inst.cleanups.push(unsubExit)

      terminal.onData((data: string) => {
        if (IS_WEB) terminal.write(data)
        window.terminal?.write?.(inst.ptyId, data)
      })
      terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => window.terminal?.resize?.(inst.ptyId, cols, rows))
      window.electron?.send?.('terminal:ready', { terminalId: inst.ptyId })
    }).catch((err: Error) => {
      terminal.writeln('\r\n\x1b[31mError de conexión\x1b[0m')
      terminal.writeln(`\x1b[90m${err.message}\x1b[0m`)
    })
  }

  function initAgentMirror(inst: TerminalInstance, procId: string) {
    inst.connected = true
    const unregister = registerAgentTerminalWriter(procId, (chunk) => inst.terminal.write(chunk))
    inst.cleanups.push(unregister)
  }

  function scheduleFit() {
    if (fitTimerRef.current) return
    fitTimerRef.current = window.setTimeout(() => {
      fitTimerRef.current = 0
      for (const inst of instancesRef.current.values()) {
        try { inst.fitAddon.fit() } catch { /* ignore */ }
      }
    }, 80)
  }

  function createTerminalInstance(tabId: string): TerminalInstance | null {
    const container = containersRef.current.get(tabId)
    if (!container) return null
    const tab = store.getState().tabs.find((t) => t.id === tabId)
    if (!tab) return null

    const terminal = new Terminal({
      cursorBlink: tab.kind === 'user',
      disableStdin: tab.kind === 'agent',
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
      lineHeight: 1.3,
      convertEol: true,
      scrollback: tab.kind === 'agent' ? 2000 : 5000,
      theme: getXtermTheme(),
      allowProposedApi: true,
    })

    terminal.loadAddon(new WebLinksAddon())

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    const searchAddon = new SearchAddon()
    terminal.loadAddon(searchAddon)

    terminal.onSelectionChange(() => forceRender(n => n + 1))

    const inst: TerminalInstance = {
      terminal, fitAddon, searchAddon, container,
      tabId: tab.id,
      ptyId: tab.procId ?? `sparta-term-${generateId()}`,
      connected: false,
      shellName: '',
      cleanups: [],
    }

    terminal.open(container)
    requestAnimationFrame(() => {
      fitAddon.fit()
      if (tab.kind === 'agent' && tab.procId) {
        seedAgentTerminalCommand(tab.procId, tab.title)
        initAgentMirror(inst, tab.procId)
      } else {
        initUserPTY(inst, selectedProfile || undefined)
      }
    })

    const ro = new ResizeObserver(() => scheduleFit())
    ro.observe(container)
    inst.cleanups.push(() => ro.disconnect())

    return inst
  }

  const containerRefCallback = useCallback((tabId: string) => (el: HTMLDivElement | null) => {
    containersRef.current.set(tabId, el)
    if (el && !instancesRef.current.has(tabId)) {
      const inst = createTerminalInstance(tabId)
      if (inst) instancesRef.current.set(tabId, inst)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.terminal) return

    const unsubSpawn = window.terminal.onAgentSpawn?.(({ procId, command }: { procId: string; command: string }) => {
      store.getState().ensureAgentTab(procId, command)
      seedAgentTerminalCommand(procId, command)
    })
    const unsubOutput = window.terminal.onAgentOutput?.(({ procId, chunk }: { procId: string; chunk: string }) => {
      writeAgentTerminalChunk(procId, chunk)
    })
    const unsubExit = window.terminal.onAgentExit?.(({ procId, code }: { procId: string; code: number }) => {
      writeAgentTerminalChunk(procId, `\r\n\x1b[33mProceso de agente terminado (código: ${code})\x1b[0m\r\n`)
      setTimeout(() => store.getState().closeAgentTabByProc(procId), 3000)
    })
    return () => { unsubSpawn?.(); unsubOutput?.(); unsubExit?.() }
  }, [])

  useEffect(() => {
    const unsub = useTerminalStore.subscribe((state, prev) => {
      if (state.tabs.length >= prev.tabs.length) return
      const removed = prev.tabs.filter((t) => !state.tabs.some((st) => st.id === t.id))
      for (const tab of removed) {
        const inst = instancesRef.current.get(tab.id)
        if (inst) {
          inst.cleanups.forEach((fn) => fn())
          inst.terminal.dispose()
          instancesRef.current.delete(tab.id)
          containersRef.current.delete(tab.id)
        }
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => scheduleFit(), 300)
    return () => clearTimeout(t)
  }, [activeTabId])

  function addTab() { store.getState().createTab() }

  function closeTab(tabId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const inst = instancesRef.current.get(tabId)
    if (inst) {
      inst.cleanups.forEach((fn) => fn())
      inst.terminal.dispose()
      const tab = store.getState().tabs.find((t) => t.id === tabId)
      if (tab?.kind === 'user') window.terminal?.destroy(inst.ptyId)
      else if (tab?.kind === 'agent' && tab.procId) { window.terminal?.agentKill(tab.procId); clearAgentTerminal(tab.procId) }
      instancesRef.current.delete(tabId)
    }
    containersRef.current.delete(tabId)
    store.getState().closeTab(tabId)
  }

  function handleNewSession(tabId: string) {
    const inst = instancesRef.current.get(tabId)
    const tab = store.getState().tabs.find((t) => t.id === tabId)
    if (!inst || tab?.kind !== 'user') return
    inst.cleanups.forEach((fn) => fn())
    inst.cleanups = []
    inst.terminal.reset()
    inst.connected = false
    inst.shellName = ''
    inst.ptyId = `sparta-term-${generateId()}`
    initUserPTY(inst, selectedProfile || undefined)
  }

  function renderTabInfo(tabId: string): { shell: string; connected: boolean; kind: 'user' | 'agent' } {
    const inst = instancesRef.current.get(tabId)
    const tab = tabs.find((t) => t.id === tabId)
    return {
      shell: inst?.shellName
        ? inst.shellName.split('\\').pop()?.split('/').pop() ?? inst.shellName
        : tab?.title ?? 'Terminal',
      connected: inst?.connected ?? false,
      kind: tab?.kind ?? 'user',
    }
  }

  function renderSelectionPopup() {
    const inst = activeInstance
    if (!inst) return null
    const sel = inst.terminal.getSelection()
    if (!sel) return null
    const rect = inst.container.getBoundingClientRect()
    return (
      <TerminalSelectionPopup
        style={{ left: rect.right - 180, top: rect.top + 8 }}
        onAddToChat={() => {
          useChatStore.getState().injectWhileStreaming(`\`\`\`terminal\n${sel}\n\`\`\``)
        }}
        onClose={() => { inst.terminal.clearSelection(); forceRender(n => n + 1) }}
      />
    )
  }

  if (!FEATURES.terminal) return null

  return (
    <div className="flex flex-col h-full bg-background" style={{ background: TERMINAL_PALETTE.bg }}>
      {/* Header bar */}
      <div
        className="flex items-center justify-between shrink-0 h-10 px-2.5 shadow-[0_1px_0_rgba(255,255,255,0.025)]"
        style={{
          background: TERMINAL_PALETTE.surface,
          borderBottom: `1px solid ${TERMINAL_PALETTE.borderSubtle}`,
        }}
      >
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 h-full">
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.09em] shrink-0"
            style={{ color: TERMINAL_PALETTE.textMuted }}
          >
            <TerminalIcon className="w-3.5 h-3.5" style={{ color: TERMINAL_PALETTE.accent }} />
            Terminal
          </div>
          <div className="h-4 w-px bg-[#ffffff12] shrink-0" />
          {tabs.map((tab) => {
            const info = renderTabInfo(tab.id)
            const isActive = tab.id === activeTabId
            return (
              <button
                key={tab.id}
                onClick={() => store.getState().selectTab(tab.id)}
                className={cn(
                  'group flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-md border transition-all shrink-0 max-w-[170px] whitespace-nowrap',
                  isActive
                    ? 'text-[#f0f0f7] bg-[#ffffff0c] border-[#ffffff14]'
                    : 'text-[#88889d] border-transparent hover:text-[#d4d4e0] hover:bg-[#ffffff08]'
                )}
                style={isActive ? { boxShadow: `inset 0 -1px 0 ${TERMINAL_PALETTE.accent}` } : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                {info.kind === 'agent' ? (
                  <Bot className="w-3 h-3 shrink-0" style={{ color: TERMINAL_PALETTE.accent }} />
                ) : (
                  <span
                    className={cn(
                      'inline-block w-1.5 h-1.5 rounded-full shrink-0 ring-2 ring-[#15151d]',
                      info.connected ? 'bg-[#48bb78]' : 'bg-[#6b6b80]'
                    )}
                  />
                )}
                <span className="truncate">{info.shell}</span>
                <span
                  onClick={(e) => closeTab(tab.id, e)}
                  className="inline-flex items-center justify-center w-4 h-4 rounded opacity-0 group-hover:opacity-100 hover:bg-[#ffffff14] hover:text-[#e6e6ef] ml-0.5 shrink-0 transition-opacity"
                  style={{ color: TERMINAL_PALETTE.textMuted }}
                  aria-label={`Cerrar ${info.shell}`}
                >
                  <X className="w-2.5 h-2.5" />
                </span>
              </button>
            )
          })}
          <button
            onClick={addTab}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md hover:text-white hover:bg-[#ffffff0e] shrink-0 ml-0.5 transition-colors"
            style={{ color: TERMINAL_PALETTE.textMuted }}
            title="Nueva terminal"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 h-full">
          {/* Live system metrics */}
          {metrics && (
            <div
              className="hidden md:flex items-center gap-2 px-2 py-0.5 rounded text-[10.5px] font-mono select-none"
              style={{
                color: TERMINAL_PALETTE.textMuted,
                background: 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${TERMINAL_PALETTE.borderSubtle}`,
              }}
              title="Métricas en tiempo real"
            >
              <Activity className="size-3 text-[#48bb78]" />
              <span>CPU {metrics.cpuPercent.toFixed(1)}%</span>
              <span className="opacity-40">·</span>
              <span>RAM {metrics.memoryMb} MB</span>
            </div>
          )}

          {activeInstance && renderTabInfo(activeTabId ?? '').kind === 'user' && (
            <>
              <button
                onClick={() => handleNewSession(activeTabId!)}
                className="inline-flex items-center justify-center w-7 h-7 hover:text-white rounded-md hover:bg-[#ffffff0e] transition-colors"
                style={{ color: TERMINAL_PALETTE.textMuted }}
                title="Reiniciar sesión"
                aria-label="Reiniciar sesión"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu((v) => !v)}
                  className="flex items-center gap-1.5 h-7 px-2 text-[11px] font-medium hover:text-white rounded-md hover:bg-[#ffffff0e] transition-colors"
                  style={{ color: TERMINAL_PALETTE.textSecondary }}
                  title="Cambiar intérprete"
                  aria-expanded={showProfileMenu}
                >
                  <span className="max-w-16 truncate">{selectedProfile || 'Predeterminado'}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <div
                      className="absolute right-0 top-full mt-1.5 z-50 w-40 py-1.5 rounded-lg shadow-2xl"
                      style={{ background: '#20202b', border: `1px solid ${TERMINAL_PALETTE.borderStrong}` }}
                    >
                      <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: TERMINAL_PALETTE.textMuted }}>Intérprete</p>
                      {['', 'cmd', 'pwsh', 'bash', 'zsh'].map((p) => (
                        <button
                          key={p}
                          onClick={() => { setSelectedProfile(p); setShowProfileMenu(false); handleNewSession(activeTabId!) }}
                          className={cn('w-full text-left px-3 py-1.5 text-[11px] transition-colors hover:bg-[#ffffff0d]', selectedProfile === p ? 'text-[#ddd6fe]' : 'text-[#d2d2df]')}
                        >
                          {p || 'Predeterminado'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
          <button
            onClick={toggleTerminal}
            className="inline-flex items-center justify-center w-7 h-7 hover:text-white rounded-md hover:bg-[#ffffff0e] transition-colors"
            style={{ color: TERMINAL_PALETTE.textMuted }}
            title="Ocultar terminal"
            aria-label="Ocultar terminal"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="relative min-h-0" style={{ background: TERMINAL_PALETTE.bg, flex: 1, padding: '6px 12px' }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={containerRefCallback(tab.id)}
            className={cn('absolute inset-3', tab.id === activeTabId ? 'visible' : 'invisible pointer-events-none')}
          />
        ))}

        {/* Search floating panel */}
        {searchVisible && (
          <div
            style={{
              position: 'absolute',
              top: 4,
              right: 12,
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: TERMINAL_PALETTE.cardBg,
              border: `1px solid ${TERMINAL_PALETTE.border}`,
              borderRadius: 6,
              padding: '4px 8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <input
              ref={searchInputRef}
              autoFocus
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (activeInstance) {
                  if (e.target.value) {
                    activeInstance.searchAddon.findNext(e.target.value)
                  } else {
                    activeInstance.searchAddon.clearDecorations()
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (activeInstance && searchQuery) {
                    activeInstance.searchAddon.findNext(searchQuery, { caseSensitive: false, incremental: e.shiftKey })
                  }
                }
              }}
              placeholder="Buscar en terminal... (Ctrl+F)"
              style={{
                background: TERMINAL_PALETTE.bg,
                border: `1px solid ${TERMINAL_PALETTE.border}`,
                borderRadius: 4,
                padding: '3px 8px',
                color: TERMINAL_PALETTE.textSecondary,
                fontSize: 11,
                fontFamily: 'monospace',
                width: 200,
                outline: 'none',
              }}
            />
            <button
              onClick={() => {
                if (activeInstance && searchQuery) {
                  activeInstance.searchAddon.findNext(searchQuery, { caseSensitive: false })
                }
              }}
              className="p-1 hover:bg-[#ffffff14] rounded transition-colors"
              style={{ color: TERMINAL_PALETTE.textMuted }}
              title="Siguiente"
            >
              <ChevronDown className="size-3" />
            </button>
            <button
              onClick={() => {
                if (activeInstance && searchQuery) {
                  activeInstance.searchAddon.findPrevious(searchQuery, { caseSensitive: false })
                }
              }}
              className="p-1 hover:bg-[#ffffff14] rounded transition-colors"
              style={{ color: TERMINAL_PALETTE.textMuted }}
              title="Anterior"
            >
              <ChevronUp className="size-3" />
            </button>
            <button
              onClick={() => { setSearchVisible(false); setSearchQuery(''); activeInstance?.searchAddon.clearDecorations() }}
              className="p-1 hover:bg-[#ffffff14] rounded transition-colors ml-0.5"
              style={{ color: TERMINAL_PALETTE.textMuted }}
              title="Cerrar búsqueda"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>

      {renderSelectionPopup()}
    </div>
  )
}
