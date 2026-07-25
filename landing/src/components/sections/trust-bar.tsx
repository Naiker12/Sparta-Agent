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
      name: 'Python 3.11',
      role: 'LangGraph Sidecar',
      color: 'text-amber-400',
      icon: (props: any) => (
        <svg viewBox="0 0 110 110" className={props.className} fill="currentColor">
          <path d="M55 2C30.7 2 32.5 12.4 32.5 12.4l.1 10.3h22.7v3.2H22.4S2 25.8 2 50.3c0 24.5 17.8 23.6 17.8 23.6h10.6v-15c0-10 8.2-18.7 18.2-18.7h23.7V25.2S73 2 55 2zm-12.8 9c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5 2.2-5 5-5z" fill="#3776ab" />
          <path d="M55 108c24.3 0 22.5-10.4 22.5-10.4l-.1-10.3H54.7v-3.2h32.9S108 84.2 108 59.7c0-24.5-17.8-23.6-17.8-23.6H79.6v15c0 10-8.2 18.7-18.2 18.7H37.7v15.1S37 108 55 108zm6.8-9c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5 2.2-5 5-5z" fill="#ffd343" />
        </svg>
      )
    },
    {
      name: 'Rust 1.85',
      role: 'Security Broker',
      color: 'text-orange-400',
      icon: (props: any) => (
        <svg viewBox="0 0 100 100" className={props.className} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
          <circle cx="50" cy="50" r="32" />
          <circle cx="50" cy="50" r="22" strokeDasharray="6,6" />
          <path d="M50 10 L50 22 M50 78 L50 90 M10 50 L22 50 M78 50 L90 50 M22 22 L31 31 M69 69 L78 78 M78 22 L69 31 M31 69 L22 78" />
          <text x="50" y="57" textAnchor="middle" fontSize="20" fontFamily="sans-serif" fontWeight="bold" fill="currentColor" stroke="none">R</text>
        </svg>
      )
    },
    {
      name: 'LangGraph',
      role: 'Reasoning Engine',
      color: 'text-indigo-400',
      icon: (props: any) => (
        <svg viewBox="0 0 100 100" className={props.className} fill="none" stroke="currentColor" strokeWidth="5.5">
          <circle cx="25" cy="50" r="8" fill="currentColor" />
          <circle cx="50" cy="25" r="8" fill="currentColor" />
          <circle cx="50" cy="75" r="8" fill="currentColor" />
          <circle cx="75" cy="50" r="8" fill="currentColor" />
          <line x1="33" y1="46" x2="42" y2="29" />
          <line x1="33" y1="54" x2="42" y2="71" />
          <line x1="58" y1="29" x2="67" y2="46" />
          <line x1="58" y1="71" x2="67" y2="54" />
          <line x1="50" y1="33" x2="50" y2="67" />
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
