import { useSessionStore } from '@/stores/session.store'
import { SessionItem } from './SessionItem'

export function SessionList() {
  const { sessions } = useSessionStore()

  if (sessions.length === 0) {
    return (
      <p
        style={{
          padding: '4px 14px 8px',
          fontSize: 11,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        Aún no hay sesiones. Crea una nueva.
      </p>
    )
  }

  return (
    <div>
      {sessions.map((session) => (
        <SessionItem key={session.id} session={session} />
      ))}
    </div>
  )
}
