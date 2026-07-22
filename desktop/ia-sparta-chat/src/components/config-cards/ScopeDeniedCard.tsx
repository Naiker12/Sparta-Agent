import { motion } from 'framer-motion'
import { ShieldOff } from 'lucide-react'

interface ScopeDeniedCardProps {
  action: string
  message?: string
}

/**
 * ScopeDeniedCard — tarjeta informativa que se muestra cuando el agente
 * intenta ejecutar una acción fuera del scope de configuración.
 *
 * Solo informativa, sin botones de acción destructiva.
 * Coincide con el mensaje de `scope_rules.py::get_denied_message()`.
 */
export function ScopeDeniedCard({ action, message }: ScopeDeniedCardProps) {
  const defaultMessage = (
    `La acción '${action}' está fuera del scope de configuración. `
    + `En este modo solo puedes: listar, agregar, activar o desactivar `
    + `proveedores de IA, skills y servidores MCP. `
    + `Si necesitas hacer otra cosa, cambia al modo normal de chat/agente.`
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid color-mix(in srgb, var(--status-warn) 30%, transparent)',
        background: 'color-mix(in srgb, var(--status-warn) 8%, transparent)',
        marginBottom: 6,
        fontFamily: 'var(--font-ui)',
      }}
      role="alert"
    >
      {/* Warning icon */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--status-warn) 15%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <ShieldOff size={14} strokeWidth={1.5} style={{ color: 'var(--status-warn)' }} />
      </div>

      {/* Message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--status-warn)',
          marginBottom: 4,
        }}>
          Acción fuera de alcance
        </div>
        <div style={{
          fontSize: 10.5,
          lineHeight: 1.5,
          color: 'var(--text-secondary)',
        }}>
          {message ?? defaultMessage}
        </div>
      </div>
    </motion.div>
  )
}