import { useRef, useState, useCallback, useEffect } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { FEATURES } from '@/lib/env-adapter'
import { generateId, cn } from '@/lib/utils'
import { getXtermTheme } from '@/lib/xterm-theme'
import { Plus, X, ChevronDown, Terminal as TerminalIcon, MessageSquarePlus } from 'lucide-react'
import { useUIStore } from '@/stores/ui.store'
import { useChatStore } from '@/stores/chat.store'
import '@xterm/xterm/css/xterm.css'

interface TerminalTab {
  id: string
  label: string
}

interface TerminalInstance {
  terminal: Terminal
  fitAddon: FitAddon
  container: HTMLDivElement
  tabId: string
  ptyId: string
  connected: boolean
  shellName: string
  cleanups: (() => void)[]
}

let _tabCounter = 0

function createNewTab(): TerminalTab {
  _tabCounter++
  return {
    id: generateId(),
    label: `Terminal ${_tabCounter}`,
  }
}

function TerminalSelectionPopup({
  style,
  onAddToChat,
  onClose,
}: {
  style: React.CSSProperties
  onAddToChat: () => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed z-50 flex items-center gap-1 px-1.5 py-1 rounded-lg shadow-lg"
      style={{
        ...style,
        background: '#1e1e2e',
        border: '1px solid #313244',
      }}
    >
      <button
        onClick={() => { onAddToChat(); onClose() }}
        className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-[#cdd6f4] rounded hover:bg-[#313244] transition-colors"
        title="Agregar selección al chat"
      >
        <MessageSquarePlus className="w-3 h-3" />
        <span>Agregar al chat</span>
      </button>
      <button
        onClick={onClose}
        className="flex items-center justify-center w-5 h-5 text-[#6c7086] hover:text-[#cdd6f4] rounded hover:bg-[#313244] transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

export function TerminalPanel() {
  if (!FEATURES.terminal) return null

  const toggleTerminal = useUIStore((s) => s.toggleTerminal)

  const [tabs, setTabs] = useState<TerminalTab[]>([createNewTab()])
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id)
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null)

  const instancesRef = useRef<Map<string, TerminalInstance>>(new Map())
  const containersRef = useRef<Map<string, HTMLDivElement | null>>(new Map())

  const activeInstance = instancesRef.current.get(activeTabId)

  function initPTY(inst: TerminalInstance) {
    const terminal = inst.terminal
    const { cols, rows } = terminal

    const unsubData = window.terminal.onData(inst.ptyId, (data: string) => {
      terminal.write(data)
    })
    inst.cleanups.push(unsubData)

    window.terminal.create({
      terminalId: inst.ptyId,
      cols,
      rows,
    }).then((result: { success: boolean; shell: string; error?: string }) => {
      if (!result.success) {
        terminal.writeln('\r\n\x1b[31mError al iniciar shell\x1b[0m')
        if (result.error) {
          terminal.writeln(`\x1b[90m${result.error}\x1b[0m`)
        }
        return
      }

      inst.connected = true
      inst.shellName = result.shell

      const unsubExit = window.terminal.onExit(inst.ptyId, (code: number) => {
        inst.connected = false
        terminal.writeln(`\r\n\x1b[33mProceso terminado (código: ${code})\x1b[0m`)
        terminal.writeln('\x1b[90mPresiona cualquier tecla para iniciar una nueva sesión\x1b[0m')
      })
      inst.cleanups.push(unsubExit)

      terminal.onData((data: string) => {
        window.terminal.write(inst.ptyId, data)
      })

      terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        window.terminal.resize(inst.ptyId, cols, rows)
      })

      window.electron.send('terminal:ready', { terminalId: inst.ptyId })
    }).catch((err: Error) => {
      terminal.writeln('\r\n\x1b[31mError de conexión\x1b[0m')
      terminal.writeln(`\x1b[90m${err.message}\x1b[0m`)
    })
  }

  function createTerminalInstance(tabId: string): TerminalInstance | null {
    const container = containersRef.current.get(tabId)
    if (!container) return null

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

    terminal.loadAddon(new Unicode11Addon())
    terminal.loadAddon(new WebLinksAddon())
    terminal.unicode.activeVersion = '11'

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    try {
      const webglAddon = new WebglAddon()
      terminal.loadAddon(webglAddon)
      webglAddon.onContextLoss(() => webglAddon.dispose())
    } catch {}

    terminal.onSelectionChange(() => {
      const sel = terminal.getSelection()
      if (sel) {
        const rect = container.getBoundingClientRect()
        setSelectionPopup({ text: sel, x: rect.right - 180, y: rect.top + 8 })
      } else {
        setSelectionPopup(null)
      }
    })

    const ptyId = `sparta-term-${generateId()}`
    const inst: TerminalInstance = {
      terminal,
      fitAddon,
      container,
      tabId,
      ptyId,
      connected: false,
      shellName: '',
      cleanups: [],
    }

    terminal.open(container)
    requestAnimationFrame(() => {
      fitAddon.fit()
      initPTY(inst)
    })

    const ro = new ResizeObserver(() => {
      try { fitAddon.fit() } catch { }
    })
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
    if (!selectionPopup) return
    const text = selectionPopup.text
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        if (activeInstance) {
          const msg = `\`\`\`terminal\n${text}\n\`\`\``
          useChatStore.getState().injectWhileStreaming(msg)
        }
        setSelectionPopup(null)
      }
      if (e.key === 'Escape') setSelectionPopup(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectionPopup, activeInstance])

  useEffect(() => {
    const timer = setTimeout(() => {
      const inst = instancesRef.current.get(activeTabId)
      if (inst) {
        try { inst.fitAddon.fit() } catch {}
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [activeTabId])

  function addTab() {
    const tab = createNewTab()
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
  }

  function closeTab(tabId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const inst = instancesRef.current.get(tabId)
    if (inst) {
      inst.cleanups.forEach(fn => fn())
      inst.terminal.dispose()
      window.terminal?.destroy(inst.ptyId)
      instancesRef.current.delete(tabId)
    }
    containersRef.current.delete(tabId)

    setTabs(prev => {
      const next = prev.filter(t => t.id !== tabId)
      if (next.length === 0) {
        return [createNewTab()]
      }
      if (tabId === activeTabId) {
        const idx = prev.findIndex(t => t.id === tabId)
        const newActive = next[Math.min(idx, next.length - 1)]
        setTimeout(() => setActiveTabId(newActive.id), 0)
      }
      return next
    })
  }

  function handleNewSession(tabId: string) {
    const inst = instancesRef.current.get(tabId)
    if (!inst) return
    inst.cleanups.forEach(fn => fn())
    inst.cleanups = []
    inst.terminal.reset()
    inst.connected = false
    inst.shellName = ''
    inst.ptyId = `sparta-term-${generateId()}`
    initPTY(inst)
  }

  function renderTabLabel(tabId: string): { shell: string; connected: boolean } {
    const inst = instancesRef.current.get(tabId)
    const tab = tabs.find(t => t.id === tabId)
    return {
      shell: inst?.shellName
        ? inst.shellName.split('\\').pop()?.split('/').pop() ?? inst.shellName
        : tab?.label ?? 'Terminal',
      connected: inst?.connected ?? false,
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0C0C10]">
      <div className="flex items-center justify-between px-2 py-1 bg-[#0f0f14] border-b border-[#ffffff12] shrink-0 min-h-0">
        <div className="flex items-center gap-0.5 overflow-x-auto min-w-0">
          {tabs.map(tab => {
            const info = renderTabLabel(tab.id)
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-[450] rounded-t border-b-[1.5px] transition-colors shrink-0 max-w-[160px] whitespace-nowrap",
                  tab.id === activeTabId
                    ? "text-[#e0e0ec] border-[#6366F1] bg-[#0C0C10]"
                    : "text-[#6b6b80] border-transparent hover:text-[#a0a0b8] hover:bg-[#ffffff08]"
                )}
              >
                <span className={cn(
                  "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                  info.connected ? "bg-[#48bb78]" : "bg-[#6b6b80]"
                )} />
                <span className="truncate">{info.shell}</span>
                {tabs.length > 1 && (
                  <span
                    onClick={(e) => closeTab(tab.id, e)}
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded hover:bg-[#ffffff14] ml-0.5 shrink-0"
                  >
                    <X className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            )
          })}
          <button
            onClick={addTab}
            className="inline-flex items-center justify-center w-5 h-5 rounded text-[#6b6b80] hover:text-[#e0e0ec] hover:bg-[#ffffff0a] shrink-0 ml-1"
            title="Nueva terminal"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {activeInstance && (
            <button
              onClick={() => handleNewSession(activeTabId)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-[#6b6b80] hover:text-[#a0a0b8] rounded hover:bg-[#ffffff08]"
              title="Reiniciar sesión"
            >
              <TerminalIcon className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={toggleTerminal}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-[#6b6b80] hover:text-[#e0e0ec] rounded hover:bg-[#ffffff0a]"
            title="Cerrar terminal"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        {tabs.map(tab => (
          <div
            key={tab.id}
            ref={containerRefCallback(tab.id)}
            className={cn(
              "absolute inset-0",
              tab.id === activeTabId ? "visible" : "invisible pointer-events-none"
            )}
          />
        ))}
      </div>

      {selectionPopup && (
        <TerminalSelectionPopup
          style={{ left: selectionPopup.x, top: selectionPopup.y }}
          onAddToChat={() => {
            const msg = `\`\`\`terminal\n${selectionPopup.text}\n\`\`\``
            useChatStore.getState().injectWhileStreaming(msg)
          }}
          onClose={() => setSelectionPopup(null)}
        />
      )}
    </div>
  )
}
