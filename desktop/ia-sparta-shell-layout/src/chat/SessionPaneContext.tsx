import { createContext, useContext } from 'react'

const SessionPaneContext = createContext<string | null>(null)

export function usePaneSessionId(): string | null {
  return useContext(SessionPaneContext)
}

export function SessionPaneProvider({
  sessionId,
  children,
}: {
  sessionId: string
  children: React.ReactNode
}) {
  return (
    <SessionPaneContext.Provider value={sessionId}>
      {children}
    </SessionPaneContext.Provider>
  )
}
