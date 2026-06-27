import { useEffect, useRef } from 'react'

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    let terminal: import('@xterm/xterm').Terminal | null = null

    import('@xterm/xterm').then(({ Terminal }) => {
      import('@xterm/addon-fit').then(({ FitAddon }) => {
        if (!containerRef.current) return

        const term = new Terminal({
          cursorBlink: true,
          fontSize: 13,
          fontFamily: 'Geist Mono Variable, monospace',
          allowProposedApi: true,
          theme: {
            background: '#0C0C10',
            foreground: '#D4D4D8',
            cursor: '#A78BFA',
            selectionBackground: '#A78BFA33',
            black: '#18181B',
            red: '#F87171',
            green: '#4ADE80',
            yellow: '#FBBF24',
            blue: '#60A5FA',
            magenta: '#C084FC',
            cyan: '#22D3EE',
            white: '#D4D4D8',
            brightBlack: '#3F3F46',
            brightRed: '#FCA5A5',
            brightGreen: '#86EFAC',
            brightYellow: '#FCD34D',
            brightBlue: '#93C5FD',
            brightMagenta: '#D8B4FE',
            brightCyan: '#67E8F9',
            brightWhite: '#F4F4F5',
          },
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        const observer = new ResizeObserver(() => {
          if (containerRef.current?.offsetWidth && containerRef.current?.offsetHeight) {
            observer.disconnect()
            term.open(containerRef.current!)
            fitAddon.fit()
            term.writeln('Bienvenido a Sparta Agent Terminal')
            term.writeln('')
            term.writeln('  El terminal interactivo está disponible.')
            term.writeln('  El agente de código puede ejecutar comandos aquí.')
            term.writeln('')
            term.write('$ ')
          }
        })

        if (containerRef.current) {
          observer.observe(containerRef.current)
        }

        term.onData((data) => {
          term.write(data)
        })

        terminal = term
      })
    })

    return () => {
      terminal?.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        width: '100%',
        background: '#0C0C10',
      }}
    />
  )
}
