import { useTheme } from 'ia-sparta-core'
import { BRAND_ICONS, MONO_BRANDS } from 'ia-sparta-core'

interface BrandIconProps {
  vendor: string
  size?: number
  className?: string
}

const CATEGORY_FALLBACKS: Record<string, string> = {
  DevTools: 'git',
  Storage: 'filesystem',
  Database: 'database',
  Productivity: 'notion',
  Web: 'fetch',
  Knowledge: 'memory',
  Utility: 'time',
  Comunicación: 'slack',
  Diseño: 'figma',
  Pagos: 'stripe',
  Monitoreo: 'sentry',
}

// Built-in crisp SVG icons for major MCP vendors
function InlineSvgIcon({ vendor, size }: { vendor: string; size: number }) {
  const v = vendor.toLowerCase()

  if (v === 'gmail') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#E53935" />
        <path d="M20 4H4c-.6 0-1.1.2-1.5.6L12 12.5l9.5-7.9c-.4-.4-.9-.6-1.5-.6z" fill="#B71C1C" />
        <path d="M12 12.5L2.5 4.6C2.2 5 2 5.5 2 6v12c0 1.1.9 2 2 2h3V9.5l5 3z" fill="#4285F4" />
        <path d="M12 12.5l9.5-7.9c.3.4.5.9.5 1.4v12c0 1.1-.9 2-2 2h-3V9.5l-5 3z" fill="#34A853" />
        <path d="M17 18h3c1.1 0 2-.9 2-2V6c0-.3-.1-.6-.2-.8L17 9.5V18z" fill="#FBBC05" />
      </svg>
    )
  }

  if (v === 'google-drive' || v === 'drive') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <path d="M16 6L3.5 28.5H17.5L30 6H16Z" fill="#FFC107" />
        <path d="M30 6L17.5 28.5H44.5L32 6H30Z" fill="#1E88E5" />
        <path d="M44.5 28.5H17.5L10 42H37L44.5 28.5Z" fill="#4CAF50" />
      </svg>
    )
  }

  if (v === 'google-calendar' || v === 'calendar') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <rect x="6" y="6" width="36" height="36" rx="8" fill="#4285F4" />
        <rect x="14" y="18" width="20" height="18" rx="2" fill="#FFFFFF" />
        <path d="M14 18H34V23H14V18Z" fill="#EA4335" />
        <circle cx="20" cy="28" r="1.5" fill="#4285F4" />
        <circle cx="28" cy="28" r="1.5" fill="#4285F4" />
        <circle cx="20" cy="32" r="1.5" fill="#4285F4" />
        <circle cx="28" cy="32" r="1.5" fill="#4285F4" />
      </svg>
    )
  }

  if (v === 'google' || v === 'gemini') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <path d="M44.5 20H24V28.5H35.7C34.1 33 29.8 36 24 36C17.4 36 12 30.6 12 24C12 17.4 17.4 12 24 12C27 12 29.7 13.1 31.7 15L38 8.7C34.3 5.2 29.5 3 24 3C12.4 3 3 12.4 3 24C3 35.6 12.4 45 24 45C35.6 45 44.5 35.6 44.5 24C44.5 22.6 44.3 21.3 44.5 20Z" fill="#4285F4" />
        <path d="M6.3 14.7L13.2 19.8C15 14.5 19 10.7 24 10.7C27 10.7 29.7 11.8 31.7 13.7L38 7.4C34.3 3.9 29.5 1.7 24 1.7C16.4 1.7 9.8 7 6.3 14.7Z" fill="#EA4335" />
        <path d="M24 46.3C29.4 46.3 34.2 44.2 37.8 40.7L31.2 35.4C29.2 36.8 26.8 37.6 24 37.6C18.3 37.6 13.9 33.9 12.1 28.8L5.3 34C8.8 41.4 15.8 46.3 24 46.3Z" fill="#34A853" />
        <path d="M44.5 24C44.5 22.6 44.3 21.3 44 20H24V28.5H35.7C35 30.6 33.4 32.5 31.2 33.9L37.8 39.2C41.7 35.6 44.5 30.3 44.5 24Z" fill="#FBBC05" />
      </svg>
    )
  }

  if (v === 'slack') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <path d="M14 30C11.79 30 10 31.79 10 34C10 36.21 11.79 38 14 38C16.21 38 18 36.21 18 34V30H14Z" fill="#E01E5A" />
        <path d="M14 10C11.79 10 10 11.79 10 14C10 16.21 11.79 18 14 18H18V14C18 11.79 16.21 10 14 10Z" fill="#36C5F0" />
        <path d="M34 18C36.21 18 38 16.21 38 14C38 11.79 36.21 10 34 10C31.79 10 30 11.79 30 14V18H34Z" fill="#2EB67D" />
        <path d="M34 38C36.21 38 38 36.21 38 34C38 31.79 36.21 30 34 30H30V34C30 36.21 31.79 38 34 38Z" fill="#ECB22E" />
        <path d="M20 14V34C20 36.21 21.79 38 24 38C26.21 38 28 36.21 28 34V14C28 11.79 26.21 10 24 10C21.79 10 20 11.79 20 14Z" fill="#E01E5A" />
        <path d="M14 20H34C36.21 20 38 21.79 38 24C38 26.21 36.21 28 34 28H14C11.79 28 10 26.21 10 24C10 21.79 11.79 20 14 20Z" fill="#36C5F0" />
      </svg>
    )
  }

  if (v === 'github') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    )
  }

  if (v === 'notion') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l11.414-.746c.42-.047.84-.233.98-.653.28-.794.14-1.307-.84-1.214L6.234 2.76c-1.12.094-1.4.374-1.775 1.448zM5.58 7.054c-.607.047-.98.233-1.12.746-.28.934-.374 1.587-.374 2.381v10.457c0 1.027.42 1.494 1.494 1.401l13.097-.84c.887-.047 1.214-.513 1.214-1.541V8.501c0-.98-.42-1.447-1.447-1.354L5.58 7.054zm10.644 2.894l.047 9.057-2.801.187V11.24l-3.36 7.656-2.52.14-3.08-7.096v7.375l-2.053.14V9.614l3.546-.233 3.127 7.189 3.406-7.796 3.688-.224z" />
      </svg>
    )
  }

  if (v === 'figma') {
    return (
      <svg width={size} height={size} viewBox="0 0 38 57" fill="none">
        <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38H19V28.5Z" fill="#0ACF83" />
        <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83" />
        <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262" />
        <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E" />
        <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF" />
      </svg>
    )
  }

  // Fallback for filesystem, git, fetch, etc.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M9 12h6M12 9v6" />
    </svg>
  )
}

export function BrandIcon({ vendor, size = 16, className }: BrandIconProps) {
  const { isDark } = useTheme()
  const normalizedVendor = (vendor || 'filesystem').toLowerCase()

  // Native inline SVG vectors for instant loading & crisp rendering
  if (['gmail', 'google-drive', 'drive', 'google-calendar', 'calendar', 'google', 'gemini', 'slack', 'github', 'notion', 'figma'].includes(normalizedVendor)) {
    return <InlineSvgIcon vendor={normalizedVendor} size={size} />
  }

  const resolvedVendor = BRAND_ICONS[normalizedVendor] ? normalizedVendor : (CATEGORY_FALLBACKS[vendor] ?? 'filesystem')
  const entry = BRAND_ICONS[resolvedVendor]

  if (!entry) {
    return <InlineSvgIcon vendor={normalizedVendor} size={size} />
  }

  const rawSrc = isDark ? entry.dark : entry.light
  const src = rawSrc.startsWith('/') ? `.${rawSrc}` : rawSrc
  const isMono = MONO_BRANDS.includes(resolvedVendor)

  return (
    <img
      src={src}
      alt={vendor}
      width={size}
      height={size}
      className={`brand-icon${isMono ? ' brand-icon-mono' : ''}${className ? ` ${className}` : ''}`}
      draggable={false}
      onError={(e) => {
        // Fallback to inline vector if image asset missing
        (e.currentTarget as HTMLElement).style.display = 'none'
      }}
      style={{
        flexShrink: 0,
        objectFit: 'contain',
      }}
    />
  )
}
