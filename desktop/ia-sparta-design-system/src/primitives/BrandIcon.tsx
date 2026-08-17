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

// Built-in authentic SVGL icons for all AI providers & MCP connectors
function InlineSvgIcon({ vendor, size }: { vendor: string; size: number }) {
  const v = vendor.toLowerCase()

  // 1. OpenAI / Codex / ChatGPT (SVGL OpenAI)
  if (v === 'openai' || v.includes('gpt') || v.includes('o1') || v.includes('o3') || v.includes('codex')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#10A37F">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.259 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7466-7.0729zm-9.022 12.6081a4.475 4.475 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.5045 4.5045 0 0 1-4.4945 4.4947zm-9.6607-4.1254a4.4703 4.4703 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4997 4.4997 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.5045 4.5045 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4947 4.4947 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.6667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4997 4.4997 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1635a.0804.0804 0 0 1-.038-.0567V6.0748a4.4997 4.4997 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.4598a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
      </svg>
    )
  }

  // 2. Anthropic / Claude / Claude Code (SVGL Claude)
  if (v === 'anthropic' || v.includes('claude')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#D97736">
        <path d="M4.5 10.5C3.67 10.5 3 11.17 3 12s.67 1.5 1.5 1.5h2.88l-2.04 2.04c-.59.59-.59 1.54 0 2.12.59.59 1.54.59 2.12 0l2.04-2.04V18.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-2.88l2.04 2.04c.59.59 1.54.59 2.12 0 .59-.59.59-1.54 0-2.12l-2.04-2.04H19.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5h-2.88l2.04-2.04c.59-.59.59-1.54 0-2.12-.59-.59-1.54-.59-2.12 0l-2.04 2.04V4.5C14.5 3.67 13.83 3 13 3s-1.5.67-1.5 1.5v2.88L9.46 5.34c-.59-.59-1.54-.59-2.12 0-.59.59-.59 1.54 0 2.12l2.04 2.04H4.5z" />
      </svg>
    )
  }

  // 3. Google Gemini (SVGL Gemini 4-Point Diamond Sparkle Star)
  if (v === 'gemini' || v === 'gemini-cli' || v === 'google-gemini') {
    const gradId = `gemini-grad-${size}`
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1BA1E3" />
            <stop offset="45%" stopColor="#5B7BF5" />
            <stop offset="100%" stopColor="#9C5BF5" />
          </linearGradient>
        </defs>
        <path
          d="M12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24Z"
          fill={`url(#${gradId})`}
        />
      </svg>
    )
  }

  // 4. Groq (SVGL Groq Orange 'g')
  if (v === 'groq') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#F55036" />
        <path d="M16.5 12C16.5 14.4853 14.4853 16.5 12 16.5C9.51472 16.5 7.5 14.4853 7.5 12C7.5 9.51472 9.51472 7.5 12 7.5C13.8 7.5 15.35 8.56 16.05 10.08L13.8 10.8C13.45 10.02 12.78 9.5 12 9.5C10.62 9.5 9.5 10.62 9.5 12C9.5 13.38 10.62 14.5 12 14.5C13.38 14.5 14.5 13.38 14.5 12H12V10H16.5V12Z" fill="#FFFFFF" />
      </svg>
    )
  }

  // 5. Mistral AI (SVGL Mistral AI Orange/Red Bars)
  if (v === 'mistral' || v.includes('mistral') || v.includes('codestral') || v.includes('pixtral')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#FF7000" fillOpacity="0.12" />
        <path d="M4 18V6H8V18H4Z" fill="#FF7000" />
        <path d="M10 18V9H14V18H10Z" fill="#FF5200" />
        <path d="M16 18V12H20V18H16Z" fill="#E63900" />
      </svg>
    )
  }

  // 6. DeepSeek (SVGL DeepSeek Whale/AI Icon)
  if (v === 'deepseek') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#0066FF" fillOpacity="0.12" />
        <path d="M12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C16.42 20 20 16.42 20 12C20 7.58 16.42 4 12 4ZM15.5 13.5C15.5 14.33 14.83 15 14 15H10C9.17 15 8.5 14.33 8.5 13.5V10.5C8.5 9.67 9.17 9 10 9H14C14.83 9 15.5 9.67 15.5 10.5V13.5Z" fill="#0066FF" />
        <circle cx="11" cy="11.5" r="1" fill="#FFFFFF" />
        <circle cx="13" cy="11.5" r="1" fill="#FFFFFF" />
      </svg>
    )
  }

  // 7. Ollama (SVGL Ollama Llama)
  if (v === 'ollama') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#FFFFFF" fillOpacity="0.08" stroke="currentColor" strokeWidth="1" />
        <circle cx="9" cy="8" r="1.5" fill="currentColor" />
        <circle cx="15" cy="8" r="1.5" fill="currentColor" />
        <path d="M7 14C7 16.76 9.24 19 12 19C14.76 19 17 16.76 17 14H7Z" fill="currentColor" />
        <path d="M6 5L8 8H6V5Z" fill="currentColor" />
        <path d="M18 5L16 8H18V5Z" fill="currentColor" />
      </svg>
    )
  }

  // 8. LM Studio
  if (v === 'lmstudio') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#6C5CE7" fillOpacity="0.15" stroke="#6C5CE7" strokeWidth="1.2" />
        <circle cx="12" cy="12" r="5" stroke="#6C5CE7" strokeWidth="2" />
        <circle cx="12" cy="12" r="2" fill="#6C5CE7" />
        <path d="M12 3V6M12 18V21M3 12H6M18 12H21" stroke="#6C5CE7" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  // 9. xAI / Grok (SVGL xAI)
  if (v === 'grok' || v === 'xai') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  }

  // 10. Together AI (SVGL Together AI)
  if (v === 'together') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#6366F1" fillOpacity="0.12" />
        <path d="M12 4L19 8V16L12 20L5 16V8L12 4Z" fill="#6366F1" />
        <path d="M12 8L16 10.5V14.5L12 17L8 14.5V10.5L12 8Z" fill="#FFFFFF" />
      </svg>
    )
  }

  // 11. Cohere (SVGL Cohere Coral Shape)
  if (v === 'cohere') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#D8775A" fillOpacity="0.15" />
        <circle cx="8" cy="12" r="4" fill="#D8775A" />
        <circle cx="16" cy="12" r="4" fill="#39594D" />
        <path d="M12 8C13.5 9.5 13.5 14.5 12 16C10.5 14.5 10.5 9.5 12 8Z" fill="#F4E8D8" />
      </svg>
    )
  }

  // 12. Perplexity (SVGL Perplexity Compass Asterisk)
  if (v === 'perplexity') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#20B2AA" fillOpacity="0.15" />
        <path d="M12 3V21M3 12H21M6 6L18 18M18 6L6 18" stroke="#20B2AA" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  }

  // 13. Fireworks AI
  if (v === 'fireworks') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#FF5722" fillOpacity="0.15" />
        <path d="M12 3L14 9L20 10L15 14L17 20L12 16L7 20L9 14L4 10L10 9L12 3Z" fill="#FF5722" />
      </svg>
    )
  }

  // 14. NVIDIA (SVGL NVIDIA Green Eye)
  if (v === 'nvidia') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#76B900" fillOpacity="0.15" />
        <path d="M12 6C7.5 6 3.5 9 2 12C3.5 15 7.5 18 12 18C16.5 18 20.5 15 22 12C20.5 9 16.5 6 12 6ZM12 15.5C10.07 15.5 8.5 13.93 8.5 12C8.5 10.07 10.07 8.5 12 8.5C13.93 8.5 15.5 10.07 15.5 12C15.5 13.93 13.93 15.5 12 15.5Z" fill="#76B900" />
      </svg>
    )
  }

  // 15. Microsoft Azure (SVGL Azure Cloud)
  if (v === 'azure') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04Z" fill="#0089D6" />
      </svg>
    )
  }

  // 16. Meta / LLaMA (SVGL Meta Infinity Loop)
  if (v === 'meta' || v.includes('llama')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#0668E1">
        <path d="M17.5 7.5C15.8 7.5 14.3 8.3 13.2 9.5C12.1 8.3 10.6 7.5 8.9 7.5C5.6 7.5 3 10.1 3 13.4C3 16.7 5.6 19.3 8.9 19.3C10.6 19.3 12.1 18.5 13.2 17.3C14.3 18.5 15.8 19.3 17.5 19.3C20.8 19.3 23.4 16.7 23.4 13.4C23.4 10.1 20.8 7.5 17.5 7.5ZM8.9 17.2C6.8 17.2 5.1 15.5 5.1 13.4C5.1 11.3 6.8 9.6 8.9 9.6C10.7 9.6 12.1 10.9 12.9 12.4C12.2 13.9 10.7 17.2 8.9 17.2ZM17.5 17.2C15.7 17.2 14.2 13.9 13.5 12.4C14.3 10.9 15.7 9.6 17.5 9.6C19.6 9.6 21.3 11.3 21.3 13.4C21.3 15.5 19.6 17.2 17.5 17.2Z" />
      </svg>
    )
  }

  // 17. OpenRouter (SVGL OpenRouter Cube)
  if (v === 'openrouter' || v.includes('openrouter')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="5" fill="#6366f1" opacity="0.15" />
        <path d="M12 4L19 8V16L12 20L5 16V8L12 4Z" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="2.5" fill="#6366f1" />
      </svg>
    )
  }

  // 18. OpenCode (SVGL OpenCode Terminal)
  if (v === 'opencode' || v.includes('opencode')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="6" fill="#0EA5E9" fillOpacity="0.15" stroke="#0EA5E9" strokeWidth="1.5" />
        <path d="M8 9.5L5.5 12L8 14.5" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 9.5L18.5 12L16 14.5" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 7.5L11 16.5" stroke="#0EA5E9" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  }

  // 19. Custom Server / LLaMA.cpp
  if (v === 'custom' || v === 'llamacpp') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="4" fill="var(--accent)" fillOpacity="0.15" stroke="var(--accent)" strokeWidth="1.5" />
        <rect x="8" y="8" width="8" height="8" rx="2" fill="var(--accent)" />
        <path d="M1 9H4M1 15H4M20 9H23M20 15H23M9 1V4M15 1V4M9 20V23M15 20V23" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  // 20. Google Search / Gmail / Drive / Calendar / GitHub / Notion / Slack / Figma
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

  if (v === 'google') {
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
  if (
    [
      'openai', 'anthropic', 'claude', 'claude-code', 'google', 'gemini', 'gemini-cli', 'google-gemini',
      'groq', 'mistral', 'deepseek', 'ollama', 'lmstudio', 'xai', 'grok', 'together', 'cohere',
      'perplexity', 'fireworks', 'nvidia', 'azure', 'meta', 'llama', 'openrouter', 'opencode',
      'custom', 'llamacpp', 'gmail', 'google-drive', 'drive', 'google-calendar', 'calendar',
      'slack', 'github', 'notion', 'figma',
    ].includes(normalizedVendor) ||
    normalizedVendor.includes('gpt') ||
    normalizedVendor.includes('claude') ||
    normalizedVendor.includes('gemini') ||
    normalizedVendor.includes('opencode') ||
    normalizedVendor.includes('codex') ||
    normalizedVendor.includes('llama') ||
    normalizedVendor.includes('mistral') ||
    normalizedVendor.includes('deepseek') ||
    normalizedVendor.includes('openrouter')
  ) {
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
        (e.currentTarget as HTMLElement).style.display = 'none'
      }}
      style={{
        flexShrink: 0,
        objectFit: 'contain',
      }}
    />
  )
}
