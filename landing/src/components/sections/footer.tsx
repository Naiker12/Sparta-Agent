import { Shield, Heart, ArrowUpRight, Terminal } from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { getPublicUrl } from '../../lib/utils';

export function Footer() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc = mounted && resolvedTheme === 'light'
    ? getPublicUrl('negro/Sparta Agent.png')
    : getPublicUrl('blanco/Sparta Agent.png');

  return (
    <footer className="bg-transparent border-t border-[rgba(186,215,247,0.08)] py-16 text-xs text-[#9da7ba] relative overflow-hidden select-none">
      {/* Background soft glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[150px] bg-[#663af3]/3 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[rgba(186,215,247,0.06)]">
          
          {/* Col 1: Brand Info (Col 4) */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <img
                src={logoSrc}
                alt="Sparta Agent Logo"
                className="h-7 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="font-display font-bold text-lg text-transparent bg-clip-text bg-gradient-to-b from-[#d8ecf8] to-[#98c0ef]">
                Sparta Agent
              </span>
            </div>
            <p className="text-xs text-[#9da7ba] leading-relaxed max-w-sm">
              IDE agéntico local-first impulsado por Electron, LangGraph y Rust. Inteligencia autónoma sin comprometer la privacidad del código.
            </p>
          </div>

          {/* Col 2: Documentación (Col 3) */}
          <div className="md:col-span-3 space-y-3.5">
            <h4 className="font-mono uppercase text-[10px] font-bold text-[#d8ecf8] tracking-widest">
              Documentación
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a 
                  href="https://github.com/Naiker12/Sparta-Agent/tree/main/docs" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-all duration-200 hover:translate-x-1 flex items-center gap-1 group text-[11px]"
                >
                  <span>Documentos de Arquitectura</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#9da7ba]/40 group-hover:text-white shrink-0" />
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/Naiker12/Sparta-Agent/blob/main/docs/05-agentes.txt" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-all duration-200 hover:translate-x-1 flex items-center gap-1 group text-[11px]"
                >
                  <span>Flujo Agéntico (05-agentes)</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#9da7ba]/40 group-hover:text-white shrink-0" />
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/Naiker12/Sparta-Agent/blob/main/SECURITY.md" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-all duration-200 hover:translate-x-1 flex items-center gap-1.5 text-[11px]"
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 
                  <span>Política de Seguridad</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Repositorio & Código (Col 2) */}
          <div className="md:col-span-2 space-y-3.5">
            <h4 className="font-mono uppercase text-[10px] font-bold text-[#d8ecf8] tracking-widest">
              Ecosistema
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a 
                  href="https://github.com/Naiker12/Sparta-Agent" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-all duration-200 hover:translate-x-1 flex items-center gap-1.5 text-[11px]"
                >
                  <GithubIcon className="w-3.5 h-3.5 shrink-0" /> 
                  <span>GitHub Repository</span>
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/Naiker12/Sparta-Agent/blob/main/LICENSE" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-all duration-200 hover:translate-x-1 flex items-center gap-1 group text-[11px]"
                >
                  <span>Licencia MIT</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#9da7ba]/40 group-hover:text-white shrink-0" />
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/Naiker12/Sparta-Agent/issues" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-all duration-200 hover:translate-x-1 flex items-center gap-1 group text-[11px]"
                >
                  <span>Reportar Issue / Bug</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#9da7ba]/40 group-hover:text-white shrink-0" />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Telemetry Specs Card (Col 3) */}
          <div className="md:col-span-3 space-y-3 font-mono text-[10px]">
            <h4 className="uppercase font-bold text-[#d8ecf8] tracking-widest text-[10px]">
              Especificaciones
            </h4>
            <div className="p-3.5 rounded-[12px] bg-black/40 border border-[rgba(186,215,247,0.08)] space-y-2 text-[#9da7ba] shadow-inner">
              <div className="flex items-center justify-between pb-1.5 border-b border-[rgba(255,255,255,0.03)] text-[10px] font-bold text-[#d8ecf8]">
                <span className="flex items-center gap-1"><Terminal className="w-3 h-3 text-indigo-400" /> SYSTEM SPECS</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#c7d3ea]/50">RUNTIME</span>
                <span className="text-white font-medium truncate">Electron 30</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#c7d3ea]/50">FRONTEND</span>
                <span className="text-white font-medium truncate">React + TS</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#c7d3ea]/50">ENGINE</span>
                <span className="text-white font-medium truncate">LangGraph</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#c7d3ea]/50">SECURITY</span>
                <span className="text-emerald-400 font-medium truncate">Rust NAPI</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright and built with pride line */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#9da7ba]/70">
          <div>
            © {new Date().getFullYear()} Sparta Agent — Desarrollado por <a href="https://github.com/Naiker12" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">Naiker12</a>. Licencia MIT.
          </div>
          <div className="flex items-center gap-1">
            <span>Built with local-first pride &</span> <Heart className="w-3.5 h-3.5 text-rose-500 fill-current inline" />
          </div>
        </div>

      </div>
    </footer>
  );
}
