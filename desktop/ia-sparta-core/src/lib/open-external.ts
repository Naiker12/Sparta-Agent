/** Open a URL in the system browser via Electron IPC, or fallback to window.open. */
export function openExternal(url: string) {
  if (typeof window !== 'undefined' && window.electron?.send) {
    window.electron.send('shell:open-external', url)
  } else {
    window.open(url, '_blank', 'noopener')
  }
}
