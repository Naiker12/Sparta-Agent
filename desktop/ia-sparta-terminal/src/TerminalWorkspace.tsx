import { useRef, useEffect, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { FEATURES, IS_WEB } from 'ia-sparta-platform'
import { generateId, cn } from 'ia-sparta-core'
import { getXtermTheme } from 'ia-sparta-core'
import { Plus, ChevronDown, Terminal as TerminalIcon, MessageSquarePlus, Bot, Columns2, Shell } from 'lucide-react'
import { useUIStore } from 'ia-sparta-core'
import { useChatStore } from 'ia-sparta-core'
import { useTerminalStore } from 'ia-sparta-core'
import { registerAgentTerminalWriter, seedAgentTerminalCommand, writeAgentTerminalChunk, clearAgentTerminal } from './agent-terminal-stream'
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

function TerminalSelectionPopup({ style, onAddToChat, onClose }: { style: React.CSSProperties; onAddToChat: () => void; onClose: () => void }) {
  return (
    <div className="fixed z-50 flex items-center gap-1 px-1.5 py-1 rounded-lg shadow-lg"
      style={{ ...style, background: '#1e1e2e', border: '1px solid #313244' }}>
      <button onClick={() => { onAddToChat(); onClose() }}
        className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-[#cdd6f4] rounded hover:bg-[#313244] transition-colors"
        title="Agregar selección al chat">
        <MessageSquarePlus className="w-3 h-3" />
        <span>Agregar al chat</span>
      </button>
      <button onClick={onClose}
        className="flex items-center justify-center w-5 h-5 text-[#6c7086] hover:text-[#cdd6f4] rounded hover:bg-[#313244] transition-colors">
        <XIcon className="w-3 h-3" />
      </button>
    </div>
  )
}

function XIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function TerminalWorkspace() {
  if (!FEATURES.terminal) return null

  const toggleTerminal = useUIStore((s) => s.toggleTerminal)
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const store = useTerminalStore

  const instancesRef = useRef<Map<string, TerminalInstance>>(new Map())
  const containersRef = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const [, forceRender] = useState(0)
  const fitTimerRef = useRef<number>(0)

  useEffect(() => {
    store.getState().ensureAtLeastOneTab()
    if (!store.getState().activeTabId) {
      store.setState({ activeTabId: store.getState().tabs[0]?.id ?? null })
    }
  }, [])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [splitMode, setSplitMode] = useState<'none' | 'horizontal' | 'vertical'>('none')
  const [selectedProfile, setSelectedProfile] = useState<string>('')
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

    const unsubData = window.terminal.onData(inst.ptyId, (data: string) => terminal.write(data))
    inst.cleanups.push(unsubData)

    window.terminal.create({ terminalId: inst.ptyId, cols, rows, shell: shellProfile }).then((result) => {
      if (!result.success) {
        terminal.writeln('\r\n\x1b[31mError al iniciar shell\x1b[0m')
        if (result.error) terminal.writeln(`\x1b[90m${result.error}\x1b[0m`)
        return
      }

      inst.connected = true
      inst.shellName = result.shell ?? ''
      store.getState().reportShell(inst.tabId, result.shell ?? '')

      const unsubExit = window.terminal.onExit(inst.ptyId, (code: number) => {
        inst.connected = false
        terminal.writeln(`\r\n\x1b[33mProceso terminado (código: ${code})\x1b[0m`)
      })
      inst.cleanups.push(unsubExit)

      terminal.onData((data: string) => {
        // In web mode the Python sidecar uses a pipe-based shell without a
        // real PTY, so the backend cannot echo typed characters. Enable local
        // echo to keep the terminal usable. Electron uses node-pty, which
        // handles echo on its own.
        if (IS_WEB) terminal.write(data)
        window.terminal.write(inst.ptyId, data)
      })
      terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => window.terminal.resize(inst.ptyId, cols, rows))
      window.electron.send('terminal:ready', { terminalId: inst.ptyId })
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
        try { inst.fitAddon.fit() } catch {}
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
      fontFamily: '"Cascadia Code", "Fira Code", monospace',
      lineHeight: 1.35,
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
    const unsubSpawn = window.terminal.onAgentSpawn?.(({ procId, command }: { procId: string; command: string }) => {
      store.getState().ensureAgentTab(procId, command)
      seedAgentTerminalCommand(procId, command)
    })
    const unsubOutput = window.terminal.onAgentOutput?.(({ procId, chunk }: { procId: string; chunk: string }) => {
      writeAgentTerminalChunk(procId, chunk)
    })
    const unsubExit = window.terminal.onAgentExit?.(({ procId, code }: { procId: string; code: number }) => {
      writeAgentTerminalChunk(procId, `\r\n\x1b[33mProceso de agente terminado (código: ${code})\x1b[0m\r\n`)
      // Close the agent tab and dispose xterm after a short delay so the user sees the exit message
      setTimeout(() => store.getState().closeAgentTabByProc(procId), 3000)
    })
    return () => { unsubSpawn?.(); unsubOutput?.(); unsubExit?.() }
  }, [])

  // Clean up xterm instances when tabs are removed (e.g. by closeAgentTabByProc)
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

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between shrink-0 h-[30px] bg-sidebar border-b border-border px-2">
        <div className="flex items-center gap-0.5 overflow-x-auto min-w-0" style={{ height: '100%' }}>
          {tabs.map((tab) => {
            const info = renderTabInfo(tab.id)
            return (
              <button key={tab.id} onClick={() => store.getState().selectTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 text-[11px] font-[450] rounded-t border-b-[1.5px] transition-colors shrink-0 max-w-[150px] whitespace-nowrap',
                  tab.id === activeTabId ? 'text-[#e0e0ec] border-[#6366F1]' : 'text-[#6b6b80] border-transparent hover:text-[#a0a0b8]'
                )}
                style={{ height: '100%' }}>
                {info.kind === 'agent'
                  ? <Bot className="w-3 h-3 text-[#a78bfa] shrink-0" />
                  : <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', info.connected ? 'bg-[#48bb78]' : 'bg-[#6b6b80]')} />}
                <span className="truncate">{info.shell}</span>
                <span onClick={(e) => closeTab(tab.id, e)}
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded hover:bg-[#ffffff14] ml-0.5 shrink-0">
                  <XIcon className="w-2.5 h-2.5" />
                </span>
              </button>
            )
          })}
          <button onClick={addTab}
            className="inline-flex items-center justify-center w-5 h-5 rounded text-[#6b6b80] hover:text-[#e0e0ec] hover:bg-[#ffffff0a] shrink-0 ml-1"
            title="Nueva terminal">
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0" style={{ height: '100%' }}>
          {activeInstance && renderTabInfo(activeTabId ?? '').kind === 'user' && (
            <>
              <button onClick={() => handleNewSession(activeTabId!)}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-[#6b6b80] hover:text-[#a0a0b8] rounded hover:bg-[#ffffff08]"
                title="Reiniciar sesión">
                <TerminalIcon className="w-3 h-3" />
              </button>
              <div className="relative">
                <button onClick={() => setShowProfileMenu((v) => !v)}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-[#6b6b80] hover:text-[#a0a0b8] rounded hover:bg-[#ffffff08]"
                  title="Shell profile">
                  <Shell className="w-3 h-3" />
                </button>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-36 py-1 rounded-lg shadow-lg"
                      style={{ background: '#1e1e2e', border: '1px solid #313244' }}>
                      {['', 'cmd', 'pwsh', 'bash', 'zsh'].map((p) => (
                        <button key={p} onClick={() => { setSelectedProfile(p); setShowProfileMenu(false); handleNewSession(activeTabId!) }}
                          className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#313244] text-[#cdd6f4]">
                          {p || 'Default'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
          <button onClick={() => setSplitMode((m) => m === 'none' ? 'horizontal' : 'none')}
            className={cn('flex items-center gap-1 px-2 py-0.5 text-[10px] rounded hover:bg-[#ffffff08]',
              splitMode !== 'none' ? 'text-[#6366F1]' : 'text-[#6b6b80] hover:text-[#a0a0b8]')}
            title="Dividir terminal">
            <Columns2 className="w-3 h-3" />
          </button>
          <button onClick={toggleTerminal}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-[#6b6b80] hover:text-[#e0e0ec] rounded hover:bg-[#ffffff0a]"
            title="Cerrar terminal">
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className={cn('relative flex min-h-0', splitMode === 'horizontal' ? 'flex-row' : 'flex-col')} style={{ background: '#0C0C10', flex: 1 }}>
        <div className={cn('relative min-h-0', splitMode === 'horizontal' ? 'flex-1' : 'flex-1')}>
          {tabs.map((tab) => (
            <div key={tab.id} ref={containerRefCallback(tab.id)}
              className={cn('absolute inset-0', tab.id === activeTabId ? 'visible' : 'invisible pointer-events-none')} />
          ))}
          {searchVisible && (
            <div style={{
              position: 'absolute', top: 4, right: 12, zIndex: 20,
              display: 'flex', alignItems: 'center', gap: 4,
              background: '#1e1e2e', border: '1px solid #313244', borderRadius: 6,
              padding: '4px 8px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
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
                  background: '#0C0C10', border: '1px solid #313244', borderRadius: 4,
                  padding: '3px 8px', color: '#cdd6f4', fontSize: 11, fontFamily: 'monospace',
                  width: 200, outline: 'none',
                }}
              />
              <button onClick={() => {
                if (activeInstance && searchQuery) {
                  activeInstance.searchAddon.findNext(searchQuery, { caseSensitive: false })
                }
              }} style={{ background: 'transparent', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 11 }}>▼</button>
              <button onClick={() => {
                if (activeInstance && searchQuery) {
                  activeInstance.searchAddon.findPrevious(searchQuery, { caseSensitive: false })
                }
              }} style={{ background: 'transparent', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 11 }}>▲</button>
              <button onClick={() => { setSearchVisible(false); setSearchQuery(''); activeInstance?.searchAddon.clearDecorations() }}
                style={{ background: 'transparent', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 11, marginLeft: 2 }}>✕</button>
            </div>
          )}
        </div>
        {splitMode !== 'none' && (
          <div className={cn('relative min-h-0', splitMode === 'horizontal' ? 'flex-1 border-l border-[#ffffff12]' : 'flex-1 border-t border-[#ffffff12]')}>
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[#6b6b80]">
              Click + to add a terminal, then drag tabs to split
            </div>
          </div>
        )}
      </div>

      {renderSelectionPopup()}
    </div>
  )
}
