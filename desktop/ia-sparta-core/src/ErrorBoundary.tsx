import React from 'react'

interface Props {
  children: React.ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error?: Error
}

export class ChatErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: 32,
            gap: 12,
            color: 'var(--text-muted)',
            background: 'var(--bg-base)',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-normal)' }}>
            Algo salió mal al mostrar esta conversación
          </p>
          <p style={{ fontSize: 12, textAlign: 'center', maxWidth: 360 }}>
            Hubo un error inesperado en la interfaz del chat. Podés recargar la vista sin perder las conversaciones.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: 8,
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid var(--border-normal)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-normal)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Recargar vista
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
