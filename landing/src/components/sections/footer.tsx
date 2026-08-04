import { Shield, Heart, ArrowUpRight, Terminal } from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';
import { getPublicUrl } from '../../lib/utils';
import {
  NotionIcon,
  OneDriveIcon,
  GoogleDriveIcon,
  GmailIcon,
  SlackIcon,
  SupabaseIcon,
} from '../icons/mcp-brand-icons';

export function Footer() {
  const faviconSrc = getPublicUrl('favicon.svg');

  return (
    <footer className="bg-white dark:bg-[#040208] border-t border-slate-200 dark:border-white/10 py-12 text-xs text-slate-500 dark:text-gray-400 relative overflow-hidden max-w-full select-none font-sans transition-colors duration-300">
      {/* Background Ambient Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] max-w-[100vw] h-[160px] bg-[#663af3]/10 blur-[140px] pointer-events-none -z-10" />

      {/* UNIFIED CONTINUOUS GRID CONTAINER MAX-W-7XL BORDER-X */}
      <div className="mx-auto max-w-7xl border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-slate-200 dark:border-white/10">
          
          {/* Col 1: Crisp Icon + Full Name Text */}
          <div className="md:col-span-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <img
                src={faviconSrc}
                alt="Sparta Agent Icon Logo"
                className="h-9 w-9 object-contain filter invert dark:invert-0 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]"
              />
              <span className="font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">
                Sparta Agent
              </span>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed max-w-sm">
              IDE agéntico local-first impulsado por Electron, React, Base UI y TypeScript Native. Inteligencia autónoma sin comprometer la privacidad de tu código.
            </p>

            {/* SVGL Brand Connector Row */}
            <div className="pt-2">
              <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400 block mb-1.5 uppercase font-semibold">
                CONECTORES INTEGRADOS
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { name: 'Notion', icon: NotionIcon },
                  { name: 'OneDrive', icon: OneDriveIcon },
                  { name: 'GoogleDrive', icon: GoogleDriveIcon },
                  { name: 'Gmail', icon: GmailIcon },
                  { name: 'Slack', icon: SlackIcon },
                  { name: 'Supabase', icon: SupabaseIcon },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.name}
                      className="w-7.5 h-7.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center hover:border-slate-300 dark:hover:border-white/30 transition-colors"
                      title={item.name}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Col 2: Documentación (Col 3) */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="font-mono uppercase text-[10px] font-bold text-slate-900 dark:text-white tracking-widest">
              Documentación
            </h4>
            <ul className="space-y-2 font-mono">
              <li>
                <a 
                  href="https://github.com/Naiker12/Sparta-Agent/tree/main/docs" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-all flex items-center gap-1 group text-[11px]"
                >
                  <span>Documentos Arquitectura</span>
                  <ArrowUpRight className="w-3 h-3 text-gray-400 group-hover:text-white shrink-0" />
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/Naiker12/Sparta-Agent/blob/main/docs/25-reglas-de-imports.md" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-all flex items-center gap-1 group text-[11px]"
                >
                  <span>Reglas de Importaciones (25-reglas)</span>
                  <ArrowUpRight className="w-3 h-3 text-gray-400 group-hover:text-white shrink-0" />
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/Naiker12/Sparta-Agent/blob/main/SECURITY.md" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-all flex items-center gap-1.5 text-[11px]"
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 
                  <span>Política de Seguridad</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Repositorio & Código (Col 2) */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="font-mono uppercase text-[10px] font-bold text-slate-900 dark:text-white tracking-widest">
              Ecosistema
            </h4>
            <ul className="space-y-2 font-mono">
              <li>
                <a 
                  href="https://github.com/Naiker12/Sparta-Agent" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-all flex items-center gap-1.5 text-[11px]"
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
                  className="hover:text-white transition-all flex items-center gap-1 group text-[11px]"
                >
                  <span>Licencia MIT</span>
                  <ArrowUpRight className="w-3 h-3 text-gray-400 group-hover:text-white shrink-0" />
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/Naiker12/Sparta-Agent/issues" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-all flex items-center gap-1 group text-[11px]"
                >
                  <span>Reportar Issue / Bug</span>
                  <ArrowUpRight className="w-3 h-3 text-gray-400 group-hover:text-white shrink-0" />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Telemetry Specs Card (Col 3) */}
          <div className="md:col-span-3 space-y-2 font-mono text-[10px]">
            <h4 className="uppercase font-bold text-slate-900 dark:text-white tracking-widest text-[10px]">
              Especificaciones
            </h4>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080512] border border-slate-200 dark:border-white/10 space-y-1.5 text-slate-600 dark:text-gray-300 shadow-inner">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-900 dark:text-white">
                <span className="flex items-center gap-1.5"><Terminal className="w-3 h-3 text-[#a855f7]" /> SYSTEM SPECS</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 dark:text-gray-400">RUNTIME</span>
                <span className="text-slate-900 dark:text-white font-bold truncate">Electron 30</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 dark:text-gray-400">FRONTEND</span>
                <span className="text-slate-900 dark:text-white font-bold truncate">React 18 + TS</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 dark:text-gray-400">ENGINE</span>
                <span className="text-slate-900 dark:text-white font-bold truncate">LangGraph TS</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 dark:text-gray-400">SECURITY</span>
                <span className="text-emerald-400 font-bold truncate">Security Broker</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-slate-500 dark:text-gray-400">
          <div>
            © {new Date().getFullYear()} Sparta Agent — Desarrollado por <a href="https://github.com/Naiker12" target="_blank" rel="noopener noreferrer" className="text-[#a855f7] font-bold hover:underline">Naiker12</a>. Licencia MIT.
          </div>
          <div className="flex items-center gap-1">
            <span>Built with local-first pride &amp;</span> <Heart className="w-3.5 h-3.5 text-rose-500 fill-current inline" />
          </div>
        </div>

      </div>
    </footer>
  );
}
