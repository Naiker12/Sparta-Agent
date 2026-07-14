import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

const MENU_ITEMS = [
  {
    label: 'File',
    items: [
      { label: 'New Session', shortcut: 'Ctrl+N' },
      { label: 'New Project', shortcut: 'Ctrl+Shift+N' },
      { label: 'Open Settings', shortcut: 'Ctrl+,' },
      { label: 'Exit', shortcut: 'Alt+F4' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', shortcut: 'Ctrl+Z' },
      { label: 'Redo', shortcut: 'Ctrl+Y' },
      { label: 'Cut', shortcut: 'Ctrl+X' },
      { label: 'Copy', shortcut: 'Ctrl+C' },
      { label: 'Paste', shortcut: 'Ctrl+V' },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Toggle Sidebar', shortcut: 'Ctrl+B' },
      { label: 'Toggle Terminal', shortcut: 'Ctrl+`' },
      { label: 'Zoom In', shortcut: 'Ctrl+=' },
      { label: 'Zoom Out', shortcut: 'Ctrl+-' },
    ],
  },
  {
    label: 'Window',
    items: [
      { label: 'Minimize', shortcut: 'Ctrl+M' },
      { label: 'Toggle Full Screen', shortcut: 'F11' },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'Documentation' },
      { label: 'About Sparta Agent', shortcut: 'v0.1.0' },
    ],
  },
]

export function AppMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="no-drag" aria-label="Menú de aplicación">
            <Menu size={16} strokeWidth={1.5} />
          </Button>
        }
      />
      <DropdownMenuContent align="start" sideOffset={4}>
        {MENU_ITEMS.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
            {group.items.map((item) => (
              <DropdownMenuItem key={item.label}>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.shortcut && (
                  <span
                    style={{
                      marginLeft: 24,
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {item.shortcut}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
