
export function SvglReact({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="-11.5 -10.23174 23 20.46348" className={className}>
      <circle cx="0" cy="0" r="2.05" fill="#61DAFB" />
      <g stroke="#61DAFB" strokeWidth="1" fill="none">
        <ellipse rx="11" ry="4.2" />
        <ellipse rx="11" ry="4.2" transform="rotate(60)" />
        <ellipse rx="11" ry="4.2" transform="rotate(120)" />
      </g>
    </svg>
  )
}

export function SvglNextjs({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" className={className}>
      <mask height="180" id="mask0_next" maskUnits="userSpaceOnUse" width="180" x="0" y="0" style={{ maskType: 'alpha' }}>
        <circle cx="90" cy="90" fill="black" r="90" />
      </mask>
      <g mask="url(#mask0_next)">
        <circle cx="90" cy="90" data-circle="true" fill="black" r="90" />
        <path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#paint0_linear_next)" />
        <rect fill="url(#paint1_linear_next)" height="72" width="12" x="115" y="54" />
      </g>
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_next" x1="109" x2="144.5" y1="116.5" y2="160.5">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id="paint1_linear_next" x1="121" x2="120.799" y1="54" y2="106.875">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function SvglTypeScript({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" className={className}>
      <rect width="128" height="128" rx="16" fill="#3178C6" />
      <path fill="#FFF" d="M70.5 70.8h14.6c1.3 0 2.4.4 3.2 1.1.9.7 1.3 1.8 1.3 3.1 0 1.5-.5 2.7-1.4 3.5-.9.8-2.3 1.2-4.1 1.2-1.5 0-3-.3-4.6-.8-1.6-.5-3.1-1.3-4.5-2.3l-3.3 7.8c1.8 1.2 3.8 2.1 6.1 2.8 2.3.7 4.7 1 7.2 1 4.5 0 8.2-1.1 11-3.3s4.2-5.4 4.2-9.4c0-2.6-.6-4.9-1.9-6.8s-3-3.4-5.3-4.5c-2.3-1.1-5-1.9-8.1-2.6-2.2-.5-3.9-1-5.1-1.6-1.2-.6-2.1-1.3-2.7-2.1-.6-.8-.9-1.8-.9-3 0-1.3.4-2.3 1.3-3.1.9-.8 2.1-1.2 3.7-1.2 1.3 0 2.6.2 3.8.7 1.2.5 2.4 1.1 3.5 1.9l3.2-7.5c-1.5-.9-3.2-1.6-4.9-2.1s-3.7-.7-5.8-.7c-4.2 0-7.7 1.1-10.3 3.4-2.6 2.2-4 5.3-4 9.1 0 2.6.7 4.8 2 6.6s3.1 3.2 5.4 4.2c2.3 1 5.1 1.8 8.4 2.5 2.2.5 3.9 1 5.1 1.6 1.2.6 2.1 1.3 2.7 2.1.6.8.9 1.8.9 3 0 1.4-.5 2.6-1.4 3.4-.9.8-2.3 1.3-4.1 1.3-1.7 0-3.3-.3-4.9-1-1.6-.6-3-1.6-4.3-2.8L70.5 70.8zM31 43.6v9.3h14.8v34.8H56V52.9h14.8v-9.3H31z" />
    </svg>
  )
}

export function SvglTailwind({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="#06B6D4">
      <path d="M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C16.337,6.182,14.976,4.8,12.001,4.8z M6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 c1.177,1.194,2.538,2.576,5.512,2.576c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C9.537,13.382,8.176,12,6.001,12z" />
    </svg>
  )
}

export function SvglPython({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" className={className}>
      <path fill="#3776AB" d="M63.7 3.3c-15.8 0-25.1 7-25.1 20.3v10.4h25.8v3.5H23.1c-13.8 0-21.6 8.5-21.6 24.3 0 16 7.5 24.3 21.6 24.3h7v-12.2c0-10.4 8.7-18.7 18.7-18.7h25.5c8.3 0 15-6.8 15-15.1V23.6c0-13.3-9.5-20.3-25.6-20.3zm-10.8 7.6c3.1 0 5.6 2.5 5.6 5.6s-2.5 5.6-5.6 5.6-5.6-2.5-5.6-5.6 2.5-5.6 5.6-5.6z" />
      <path fill="#FFD43B" d="M64.3 124.7c15.8 0 25.1-7 25.1-20.3V94H63.6v-3.5h41.3c13.8 0 21.6-8.5 21.6-24.3 0-16-7.5-24.3-21.6-24.3h-7v12.2c0 10.4-8.7 18.7-18.7 18.7H43.7c-8.3 0-15 6.8-15 15.1v16.5c0 13.3 9.5 20.3 25.6 20.3zm10.8-7.6c-3.1 0-5.6-2.5-5.6-5.6s2.5-5.6 5.6-5.6 5.6 2.5 5.6 5.6-2.5 5.6-5.6 5.6z" />
    </svg>
  )
}

export function SvglNodejs({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 289" className={className}>
      <path fill="#539E43" d="M128 0L256 74v141l-128 74L0 215V74L128 0z" />
      <path fill="#333333" d="M128 26l105 60v115l-105 60-105-60V86l105-60z" />
      <path fill="#539E43" d="M136 78h-16v62l-36-21-8 14 44 26 16-9V78zm-46 64l-8-5-18 10v22l18 10 18-10v-10h-9v5l-9-5v-12l18-10zm92-10l-18-10-18 10v22l18 10 18-10v-22zm-9 22l-9 5-9-5v-12l9-5 9 5v12z" />
    </svg>
  )
}

export function SvglDocker({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="#2496ED">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.714h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H2.208a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185M23.77 11.02c-.39-.24-.9-.33-1.42-.25-.13-.47-.4-.95-.79-1.32-.42-.4-1-.66-1.65-.66-.46 0-.89.13-1.28.36-.78.47-1.34 1.25-1.57 2.16-.94-.09-1.92.05-2.73.56-1.55.97-2.28 2.76-1.8 4.47.38 1.34 1.34 2.37 2.61 2.81 1.28.45 2.7.27 3.82-.47 1.48-.98 2.27-2.75 1.95-4.5.76-.08 1.48.22 1.97.77.34.38.56.88.63 1.42.06.49.02.99-.12 1.45-.13.44-.35.83-.65 1.15-1.61 1.74-4.14 2.72-6.74 2.72-3.8 0-7.3-2.07-9.15-5.39-.33-.6-.56-1.24-.7-1.9H.21c-.12 0-.21.09-.21.21 0 3.7 2.12 7.08 5.48 8.76 2.34 1.17 4.96 1.76 7.58 1.76 4.3 0 8.52-1.58 11.83-4.47.78-.68 1.43-1.5 1.91-2.42.54-1.02.83-2.17.83-3.34 0-1.12-.27-2.21-.86-3.15z" />
    </svg>
  )
}

export function SvglGit({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" className={className}>
      <path fill="#F05032" d="M125.1 57.7L70.3 2.9c-3.8-3.8-10-3.8-13.8 0L38.8 20.6l17.4 17.4c4.1-1.4 8.9-.5 12.2 2.8 3.3 3.3 4.2 8.1 2.8 12.2l16.8 16.8c4.1-1.4 8.9-.5 12.2 2.8 4.7 4.7 4.7 12.3 0 17s-12.3 4.7-17 0c-3.6-3.6-4.4-8.8-2.5-13.1L62 57.8v34.4c1.1.5 2.1 1.3 2.9 2.1 4.7 4.7 4.7 12.3 0 17s-12.3 4.7-17 0c-4.7-4.7-4.7-12.3 0-17 1.2-1.2 2.6-2.1 4.1-2.6V56.6c-1.5-.5-2.9-1.4-4.1-2.6-3.6-3.6-4.4-8.9-2.4-13.2L28.1 23.4 2.9 48.6c-3.8 3.8-3.8 10 0 13.8l54.8 54.8c3.8 3.8 10 3.8 13.8 0l53.6-53.6c3.8-3.8 3.8-9.9 0-5.9z" />
    </svg>
  )
}

export function SvglVitest({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" className={className}>
      <defs>
        <linearGradient id="vitest-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCC72B" />
          <stop offset="100%" stopColor="#729B1B" />
        </linearGradient>
      </defs>
      <path fill="url(#vitest-grad)" d="M211.8 14.8L144.5 131l-36.2-62.8L145 7.4c3.4-6 10.8-8.1 16.8-4.7l50 28.9c6 3.4 8.1 10.8 4.7 16.8l-4.7-33.6zm-167.6 0l67.3 116.2 36.2-62.8L111 7.4c-3.4-6-10.8-8.1-16.8-4.7L44.2 31.6c-6 3.4-8.1 10.8-4.7 16.8l4.7-33.6zM128 174.6l-50.5 87.5c-3.4 6-10.8 8.1-16.8 4.7L10.7 238c-6-3.4-8.1-10.8-4.7-16.8l105.2-182.2 16.8 29.1-80 138.6 20.2 11.6L128 174.6zm0 0l50.5 87.5c3.4 6 10.8 8.1 16.8 4.7l50-28.9c6-3.4 8.1-10.8 4.7-16.8L144.8 38.9l-16.8 29.1 80 138.6-20.2 11.6L128 174.6z" />
    </svg>
  )
}

export function SvglPlaywright({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path fill="#2EAD33" d="M17.5 13.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm-5-3c-.8 0-1.5-.7-1.5-1.5S11.7 7.5 12.5 7.5s1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm6.5-6.5C16.8 2.3 14.5 1.5 12 1.5S7.2 2.3 5 4C2.8 5.7 1.5 8.2 1.5 11c0 5 4.3 9.5 10.5 11.5 6.2-2 10.5-6.5 10.5-11.5 0-2.8-1.3-5.3-3.5-7z" opacity="0.3" />
      <path fill="#45BA4B" d="M19 10.5c0 4.1-3.1 7.5-7 7.5s-7-3.4-7-7.5c0-2.3 1-4.4 2.8-5.8C9.4 3.5 10.7 3 12 3s2.6.5 4.2 1.7c1.8 1.4 2.8 3.5 2.8 5.8z" />
      <circle cx="9.5" cy="10" r="1.5" fill="#FFF" />
      <circle cx="14.5" cy="10" r="1.5" fill="#FFF" />
      <path d="M10 14.5c.6.6 1.3.8 2 .8s1.4-.2 2-.8" stroke="#FFF" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function SvglJest({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="#C21325">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16.5h-2v-2h2v2zm0-4h-2V7h2v7.5z" fill="#C21325" />
    </svg>
  )
}

export function SvglVite({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 257" className={className}>
      <defs>
        <linearGradient id="vite-grad-a" x1="-0.828%" y1="57.636%" x2="57.655%" y2="57.636%">
          <stop offset="0%" stopColor="#41D1FF" />
          <stop offset="100%" stopColor="#BD34FE" />
        </linearGradient>
        <linearGradient id="vite-grad-b" x1="43.376%" y1="2.242%" x2="50.316%" y2="89.03%">
          <stop offset="0%" stopColor="#FFEA83" />
          <stop offset="8.333%" stopColor="#FFDD35" />
          <stop offset="100%" stopColor="#FFA800" />
        </linearGradient>
      </defs>
      <path fill="url(#vite-grad-a)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62z" />
      <path fill="url(#vite-grad-b)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.044c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028 72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.77-4.115z" />
    </svg>
  )
}

export function SvglPostgres({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="#336791">
      <path d="M12.002 0c-4.418 0-8 3.582-8 8 0 3.064 1.724 5.727 4.25 7.07v3.93h2v-2.08c.563.05 1.135.08 1.75.08 4.418 0 8-3.582 8-8s-3.582-8-8-8zm-1.5 5.5c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5-1.5-.672-1.5-1.5.672-1.5 1.5-1.5zm5 8.5c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5z" />
    </svg>
  )
}

export function SvglGoogle({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
    </svg>
  )
}

export function SvglGithub({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

export function SvglSparta({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 2L3 7V13C3 18.5 7 21.5 12 23C17 21.5 21 18.5 21 13V7L12 2Z" fill="url(#sparta-shield-grad)" stroke="#D97706" strokeWidth="1" />
      <path d="M12 6L14.5 11H17.5L15 13.5L16 18L12 15.5L8 18L9 13.5L6.5 11H9.5L12 6Z" fill="#F59E0B" />
      <defs>
        <linearGradient id="sparta-shield-grad" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#78350F" />
          <stop offset="100%" stopColor="#1E1B4B" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function SvglBug({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M8 9V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V9" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="6" y="9" width="12" height="11" rx="5.5" fill="#EF4444" fillOpacity="0.18" stroke="#EF4444" strokeWidth="1.8" />
      <path d="M6 13H2M18 13H22M7 18L3 20M17 18L21 20M7 8L3 6M17 8L21 6" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="13" r="1" fill="#EF4444" />
      <circle cx="14" cy="13" r="1" fill="#EF4444" />
    </svg>
  )
}

export function SvglPerformance({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 4C7.03 4 3 8.03 3 13C3 15.63 4.13 17.99 5.93 19.62" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.07 19.62C19.87 17.99 21 15.63 21 13C21 8.03 16.97 4 12 4" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 13L16 9" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="13" r="2" fill="#F59E0B" />
    </svg>
  )
}

export function SvglCleanCode({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M4 14L8 18M14 4L18 8M17 5L19 7" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 4L6 12L4 18L10 16L18 8L14 4Z" fill="#10B981" fillOpacity="0.15" stroke="#10B981" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 15L19 17L21 18L19 19L18 21L17 19L15 18L17 17L18 15Z" fill="#10B981" />
    </svg>
  )
}

export function SvglBenchmark({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="14" width="4" height="7" rx="1" fill="#3B82F6" />
      <rect x="10" y="9" width="4" height="12" rx="1" fill="#10B981" />
      <rect x="17" y="4" width="4" height="17" rx="1" fill="#8B5CF6" />
      <path d="M3 11L9 6L14 10L21 3" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SvglDocs({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M4 19.5V4.5C4 3.67 4.67 3 5.5 3H18.5C19.33 3 20 3.67 20 4.5V19.5C20 20.33 19.33 21 18.5 21H5.5C4.67 21 4 20.33 4 19.5Z" fill="#3B82F6" fillOpacity="0.12" stroke="#3B82F6" strokeWidth="1.8" />
      <path d="M8 7H16M8 11H16M8 15H13" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function SvglTerminal({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <rect x="2" y="4" width="20" height="16" rx="4" fill="#18181B" stroke="#71717A" strokeWidth="1.5" />
      <path d="M6 9L10 12L6 15" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15H17" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function SvglMcp({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <rect x="7" y="7" width="10" height="10" rx="3" fill="#6366F1" fillOpacity="0.18" stroke="#6366F1" strokeWidth="1.8" />
      <path d="M12 2V7M12 17V22M2 12H7M17 12H22" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2" fill="#6366F1" />
    </svg>
  )
}

export function SvglApiTest({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="9" stroke="#EC4899" strokeWidth="1.8" fill="#EC4899" fillOpacity="0.12" />
      <path d="M8 12L11 15L16 9" stroke="#EC4899" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SvglSparkleAi({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="url(#sparkle-grad)" />
      <path d="M19 16L20 19L23 20L20 21L19 24L18 21L15 20L18 19L19 16Z" fill="#A855F7" />
      <defs>
        <linearGradient id="sparkle-grad" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#7E22CE" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function SvglScanCode({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M3 7V5C3 3.9 3.9 3 5 3H7M17 3H19C20.1 3 21 3.9 21 5V7M21 17V19C21 20.1 20.1 21 19 21H17M7 21H5C3.9 21 3 20.1 3 19V17" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.5" stroke="#3B82F6" strokeWidth="1.8" />
      <path d="M14.5 14.5L18 18" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function SvglRefactor({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M21 12C21 16.97 16.97 21 12 21C8.1 21 4.78 18.52 3.5 15M3 12C3 7.03 7.03 3 12 3C15.9 3 19.22 5.48 20.5 9" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 5V9H17M3 19V15H7" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SvglTestTube({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M9 3H15M10 3V8L5.5 17C4.7 18.5 5.8 20.5 7.5 20.5H16.5C18.2 20.5 19.3 18.5 18.5 17L14 8V3" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 16H17" stroke="#EC4899" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="18" r="1" fill="#EC4899" />
      <circle cx="14" cy="17.5" r="1" fill="#EC4899" />
    </svg>
  )
}

export function SvglDeepSearch({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="9.5" stroke="#10B981" strokeWidth="1.8" />
      <path d="M12 2.5C12 2.5 16 6.5 16 12C16 17.5 12 21.5 12 21.5C12 21.5 8 17.5 8 12C8 6.5 12 2.5 12 2.5Z" stroke="#10B981" strokeWidth="1.5" />
      <path d="M3 12H21" stroke="#10B981" strokeWidth="1.5" />
    </svg>
  )
}
