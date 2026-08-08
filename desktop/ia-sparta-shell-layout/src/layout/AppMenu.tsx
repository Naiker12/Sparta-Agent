import { useState, useEffect, type ComponentType } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from 'ia-sparta-design-system'
import { Button } from 'ia-sparta-design-system'
import {
  Menu,
  FilePlus,
  Settings,
  LogOut,
  Undo,
  Redo,
  Scissors,
  Copy,
  Clipboard,
  PanelLeft,
  Terminal,
  ZoomIn,
  ZoomOut,
  SquareMinus,
  Maximize2,
  BookOpen,
  Info,
} from 'lucide-react'
import {
  useUIStore,
  useSessionStore,
  useSessionTabsStore,
  useSettingsStore,
} from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { IS_ELECTRON } from 'ia-sparta-platform'

interface MenuItemData {
  key: string
  label: string
  shortcut?: string
  icon: ComponentType<{ className?: string }>
  destructive?: boolean
  onClick?: () => void
}

interface MenuGroupData {
  key: string
  label: string
  items: MenuItemData[]
}

let currentZoomFactor = 1.0

function handleZoom(delta: number) {
  currentZoomFactor = Math.max(0.75, Math.min(1.5, Math.round((currentZoomFactor + delta) * 100) / 100))

  // 1. Try Electron native webFrame zoom if available
  try {
    if ((window as any).electron?.webFrame) {
      (window as any).electron.webFrame.setZoomFactor(currentZoomFactor)
      return
    }
    const electron = (window as any).require ? (window as any).require('electron') : null
    if (electron?.webFrame) {
      electron.webFrame.setZoomFactor(currentZoomFactor)
      return
    }
  } catch { /* ignore */ }

  // 2. CSS Zoom fallback with viewport height compensation to eliminate bottom whitespace gaps
  const docEl = document.documentElement
  const bodyEl = document.body
  const adjustedHeight = `${(100 / currentZoomFactor).toFixed(2)}vh`

  docEl.style.zoom = String(currentZoomFactor)
  docEl.style.minHeight = adjustedHeight
  docEl.style.height = adjustedHeight

  if (bodyEl) {
    bodyEl.style.zoom = String(currentZoomFactor)
    bodyEl.style.minHeight = adjustedHeight
    bodyEl.style.height = adjustedHeight
  }
}

export function AppMenu() {
  const { t } = useTranslation()
  const [appVersion, setAppVersion] = useState('v0.1.5')

  useEffect(() => {
    if ((window as any).electronAPI?.getVersion) {
      (window as any).electronAPI.getVersion().then((v: string) => {
        if (v) setAppVersion(`v${v.replace(/^v/, '')}`)
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept shortcut keys if user is actively typing in an input or textarea
      const target = e.target as HTMLElement | null
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      const isCtrl = e.ctrlKey || e.metaKey

      if (isCtrl) {
        // Zoom In: Ctrl + = or Ctrl + + or NumpadAdd
        if ((e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') && !isInput) {
          e.preventDefault()
          handleZoom(0.1)
          return
        }
        // Zoom Out: Ctrl + - or NumpadSubtract
        if ((e.key === '-' || e.code === 'NumpadSubtract') && !isInput) {
          e.preventDefault()
          handleZoom(-0.1)
          return
        }
        // Toggle Sidebar: Ctrl + B
        if (e.key.toLowerCase() === 'b' && !isInput) {
          e.preventDefault()
          useUIStore.getState().toggleSidebar()
          return
        }
        // Toggle Terminal: Ctrl + ` (strictly checking e.key === '`' or '~')
        if ((e.key === '`' || e.key === '~') && !isInput) {
          e.preventDefault()
          useUIStore.getState().toggleTerminal()
          return
        }
        // New Session: Ctrl + N (without Shift)
        if (e.key.toLowerCase() === 'n' && !e.shiftKey && !isInput) {
          e.preventDefault()
          const tabs = useSessionTabsStore.getState().openTabs
          for (const id of [...tabs]) {
            useSessionTabsStore.getState().closeTab(id)
          }
          useSessionStore.getState().resetActiveSession()
          useUIStore.getState().setMainView({ type: 'chat' })
          return
        }
        // Open Settings: Ctrl + ,
        if (e.key === ',' && !isInput) {
          e.preventDefault()
          useSettingsStore.getState().openSettings()
          return
        }
      } else {
        // F11: Full Screen
        if (e.key === 'F11') {
          e.preventDefault()
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {})
          } else {
            document.exitFullscreen().catch(() => {})
          }
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const MENU_GROUPS: MenuGroupData[] = [
    {
      key: 'file',
      label: t('menu.file'),
      items: [
        {
          key: 'newSession',
          label: t('menu.newSession'),
          shortcut: 'Ctrl+N',
          icon: FilePlus,
          onClick: () => {
            const tabs = useSessionTabsStore.getState().openTabs
            for (const id of [...tabs]) {
              useSessionTabsStore.getState().closeTab(id)
            }
            useSessionStore.getState().resetActiveSession()
            useUIStore.getState().setMainView({ type: 'chat' })
          },
        },
        {
          key: 'openSettings',
          label: t('menu.openSettings'),
          shortcut: 'Ctrl+,',
          icon: Settings,
          onClick: () => {
            useSettingsStore.getState().openSettings()
          },
        },
        {
          key: 'exit',
          label: t('menu.exit'),
          shortcut: 'Alt+F4',
          icon: LogOut,
          destructive: true,
          onClick: () => {
            if ((window as any).electron?.ipcRenderer) {
              const winEnv = window as unknown as Record<string, { ipcRenderer: { send: (ch: string) => void } }>
              winEnv.electron.ipcRenderer.send('window:close')
            } else {
              window.close()
            }
          },
        },
      ],
    },
    {
      key: 'edit',
      label: t('menu.edit'),
      items: [
        {
          key: 'undo',
          label: t('menu.undo'),
          shortcut: 'Ctrl+Z',
          icon: Undo,
          onClick: () => document.execCommand('undo'),
        },
        {
          key: 'redo',
          label: t('menu.redo'),
          shortcut: 'Ctrl+Y',
          icon: Redo,
          onClick: () => document.execCommand('redo'),
        },
        {
          key: 'cut',
          label: t('menu.cut'),
          shortcut: 'Ctrl+X',
          icon: Scissors,
          onClick: () => document.execCommand('cut'),
        },
        {
          key: 'copy',
          label: t('menu.copy'),
          shortcut: 'Ctrl+C',
          icon: Copy,
          onClick: () => document.execCommand('copy'),
        },
        {
          key: 'paste',
          label: t('menu.paste'),
          shortcut: 'Ctrl+V',
          icon: Clipboard,
          onClick: () => document.execCommand('paste'),
        },
      ],
    },
    {
      key: 'view',
      label: t('menu.view'),
      items: [
        {
          key: 'toggleSidebar',
          label: t('menu.toggleSidebar'),
          shortcut: 'Ctrl+B',
          icon: PanelLeft,
          onClick: () => useUIStore.getState().toggleSidebar(),
        },
        ...(IS_ELECTRON ? [{
          key: 'toggleTerminal',
          label: t('menu.toggleTerminal'),
          shortcut: 'Ctrl+`',
          icon: Terminal,
          onClick: () => useUIStore.getState().toggleTerminal(),
        }] : []),
        {
          key: 'zoomIn',
          label: t('menu.zoomIn'),
          shortcut: 'Ctrl+=',
          icon: ZoomIn,
          onClick: () => handleZoom(0.1),
        },
        {
          key: 'zoomOut',
          label: t('menu.zoomOut'),
          shortcut: 'Ctrl+-',
          icon: ZoomOut,
          onClick: () => handleZoom(-0.1),
        },
      ],
    },
    {
      key: 'window',
      label: t('menu.window'),
      items: [
        {
          key: 'minimize',
          label: t('menu.minimize'),
          shortcut: 'Ctrl+M',
          icon: SquareMinus,
          onClick: () => {
            if ((window as any).electron?.ipcRenderer) {
              const winEnv = window as unknown as Record<string, { ipcRenderer: { send: (ch: string) => void } }>
              winEnv.electron.ipcRenderer.send('window:minimize')
            }
          },
        },
        {
          key: 'toggleFullScreen',
          label: t('menu.toggleFullScreen'),
          shortcut: 'F11',
          icon: Maximize2,
          onClick: () => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {})
            } else {
              document.exitFullscreen().catch(() => {})
            }
          },
        },
      ],
    },
    {
      key: 'help',
      label: t('menu.help'),
      items: [
        {
          key: 'documentation',
          label: t('menu.documentation'),
          icon: BookOpen,
          onClick: () => {
            window.open('https://github.com/Naiker12/Sparta-Agent#readme', '_blank')
          },
        },
        {
          key: 'about',
          label: t('menu.about'),
          shortcut: appVersion,
          icon: Info,
          onClick: () => {
            useSettingsStore.getState().openSettings()
          },
        },
      ],
    },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="no-drag h-7 w-7 rounded-md hover:bg-accent/80 transition-colors"
            aria-label="Menú de aplicación"
          >
            <Menu size={15} strokeWidth={1.75} />
          </Button>
        }
      />
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-72 min-w-[17rem] rounded-xl border border-border/80 bg-popover/95 backdrop-blur-xl p-1 shadow-2xl"
      >
        {MENU_GROUPS.map((group, gi) => (
          <div key={group.key}>
            {gi > 0 && <DropdownMenuSeparator className="my-1 border-t border-border/40" />}
            <div className="px-2.5 py-0.5 text-[9.5px] font-bold font-mono tracking-widest text-muted-foreground/80 uppercase">
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <DropdownMenuItem
                  key={item.key}
                  variant={item.destructive ? 'destructive' : 'default'}
                  onClick={item.onClick}
                  className="flex items-center justify-between gap-3 px-2.5 py-1 text-xs rounded-lg cursor-pointer transition-all hover:bg-accent/90"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-75 group-hover/dropdown-menu-item:opacity-100 transition-opacity" />
                    <span className="font-medium whitespace-nowrap">{item.label}</span>
                  </div>
                  {item.shortcut && (
                    <DropdownMenuShortcut className="font-mono text-[10px] text-muted-foreground/80 font-medium ml-3 shrink-0">
                      {item.shortcut}
                    </DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              )
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
