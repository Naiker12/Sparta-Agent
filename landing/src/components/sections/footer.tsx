import { Shield, FileText, Heart } from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

export function Footer() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc = mounted && resolvedTheme === 'light'
    ? '/negro/Sparta Agent.png'
    : '/blanco/Sparta Agent.png';

  return (
    <footer className="bg-[var(--bg-surface)] border-t border-[var(--border-normal)] py-14 text-xs text-[var(--text-secondary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[var(--border-subtle)]">
          {/* Col 1: Brand */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <img
                src={logoSrc}
                alt="Sparta Agent Logo"
                className="h-7 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="font-display font-bold text-base text-[var(--text-display)]">
                Sparta Agent
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              IDE agéntico local-first impulsado por Electron, LangGraph y Rust. Inteligencia autónoma sin comprometer la privacidad del código.
            </p>
          </div>

          {/* Col 2: Documentación */}
          <div className="space-y-3">
            <h4 className="font-mono uppercase text-[11px] font-bold text-[var(--text-display)] tracking-wider">
              Documentación
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="https://github.com/Naiker12/Sparta-Agent/tree/main/docs" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-display)] transition-colors">
                  Documentos de Arquitectura
                </a>
              </li>
              <li>
                <a href="https://github.com/Naiker12/Sparta-Agent/blob/main/docs/05-agentes.txt" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-display)] transition-colors">
                  Flujo Agéntico (docs/05-agentes.txt)
                </a>
              </li>
              <li>
                <a href="https://github.com/Naiker12/Sparta-Agent/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-display)] transition-colors flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" /> Política de Seguridad (SECURITY.md)
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Repositorio & Código */}
          <div className="space-y-3">
            <h4 className="font-mono uppercase text-[11px] font-bold text-[var(--text-display)] tracking-wider">
              Ecosistema
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="https://github.com/Naiker12/Sparta-Agent" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-display)] transition-colors flex items-center gap-1">
                  <GithubIcon className="w-3.5 h-3.5" /> GitHub Repository
                </a>
              </li>
              <li>
                <a href="https://github.com/Naiker12/Sparta-Agent/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-display)] transition-colors">
                  Licencia MIT
                </a>
              </li>
              <li>
                <a href="https://github.com/Naiker12/Sparta-Agent/issues" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-display)] transition-colors">
                  Reportar Issue / Bug
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Stack Details */}
          <div className="space-y-3 font-mono text-[11px]">
            <h4 className="uppercase font-bold text-[var(--text-display)] tracking-wider">
              Especificaciones
            </h4>
            <div className="p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] space-y-1 text-[var(--text-muted)]">
              <div>Runtime: Electron 30</div>
              <div>Frontend: React 18 + TS 5</div>
              <div>Engine: Python LangGraph</div>
              <div>Security: Rust NAPI Broker</div>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[var(--text-muted)]">
          <div>
            © {new Date().getFullYear()} Sparta Agent — Desarrollado por <a href="https://github.com/Naiker12" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Naiker12</a>. Licencia MIT.
          </div>
          <div className="flex items-center gap-1">
            <span>Built with local-first pride &</span> <Heart className="w-3.5 h-3.5 text-rose-500 fill-current inline" />
          </div>
        </div>
      </div>
    </footer>
  );
}
