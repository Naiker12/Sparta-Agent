export function TrustBar() {
  const techStack = [
    {
      name: 'React 18',
      role: 'UI Presentation',
      color: 'text-sky-400',
      icon: (props: any) => (
        <svg viewBox="-11.5 -10.23174 23 20.46348" className={props.className} fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="0" cy="0" r="2.05" fill="currentColor"/>
          <g stroke="currentColor">
            <ellipse rx="11" ry="4.2"/>
            <ellipse rx="11" ry="4.2" transform="rotate(60)"/>
            <ellipse rx="11" ry="4.2" transform="rotate(120)"/>
          </g>
        </svg>
      )
    },
    {
      name: 'TypeScript 5',
      role: 'Type Safety',
      color: 'text-[#3178c6]',
      icon: (props: any) => (
        <svg viewBox="0 0 100 100" className={props.className} fill="currentColor">
          <rect width="100" height="100" rx="12" fill="#3178c6"/>
          <text x="33" y="74" fill="white" fontSize="42" fontFamily="sans-serif" fontWeight="bold">TS</text>
        </svg>
      )
    },
    {
      name: 'Base UI',
      role: 'UI Primitives',
      color: 'text-indigo-400',
      icon: (props: any) => (
        <svg viewBox="0 0 100 100" className={props.className} fill="none" stroke="currentColor" strokeWidth="6">
          <rect x="15" y="15" width="70" height="70" rx="16" />
          <path d="M30 45 L50 65 L70 35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      name: 'Electron 30',
      role: 'Desktop Runtime',
      color: 'text-cyan-300',
      icon: (props: any) => (
        <svg viewBox="0 0 100 100" className={props.className} fill="none" stroke="currentColor" strokeWidth="5">
          <ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(30, 50, 50)" />
          <ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(90, 50, 50)" />
          <ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(150, 50, 50)" />
          <circle cx="50" cy="50" r="8" fill="currentColor" stroke="none" />
        </svg>
      )
    },
    {
      name: 'Tailwind v4',
      role: 'Styling Engine',
      color: 'text-teal-300',
      icon: (props: any) => (
        <svg viewBox="0 0 100 100" className={props.className} fill="currentColor">
          <path d="M20 40 C30 20, 50 20, 60 35 C65 42.5, 70 45, 80 45 C70 65, 50 65, 40 50 C35 42.5, 30 40, 20 40 Z" />
        </svg>
      )
    },
    {
      name: 'Node IPC',
      role: 'Security Broker',
      color: 'text-emerald-400',
      icon: (props: any) => (
        <svg viewBox="0 0 100 100" className={props.className} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
          <rect x="20" y="20" width="60" height="60" rx="12" />
          <path d="M35 50 L65 50 M50 35 L50 65" />
        </svg>
      )
    },
  ];

  return (
    <section className="py-10 border-y border-[var(--border-normal)] bg-[var(--bg-surface)]/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-6">
          ARQUITECTURA DE PRODUCCIÓN PROBADA · NATIVA Y SIN DEPENDENCIAS CLOUD OBLIGATORIAS
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {techStack.map((tech) => {
            const Icon = tech.icon;
            return (
              <div
                key={tech.name}
                className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(186,214,247,0.02)] border border-[rgba(186,215,247,0.12)] hover:border-[#663af3]/40 transition-all duration-300 group"
              >
                <div className={`p-2 rounded-lg bg-[rgba(199,211,234,0.04)] w-9 h-9 flex items-center justify-center ${tech.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#d8ecf8] font-mono">{tech.name}</div>
                  <div className="text-[10px] text-[#9da7ba]">{tech.role}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
