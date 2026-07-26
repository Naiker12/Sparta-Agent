import { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Play, 
  ArrowRight, 
  Lock, 
  Terminal, 
  Cpu,
  CheckCircle2,
  Wrench
} from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';
import { motion } from 'framer-motion';

export function Hero() {
  const [taskPrompt, setTaskPrompt] = useState('Crear tests unitarios para endpoints de autenticación');
  const [selectedModel, setSelectedModel] = useState('ollama-llama3');

  const stats = [
    { value: '100%', label: 'Privacidad Local', subtext: 'GDPR / CCPA / Air-Gapped' },
    { value: '< 15ms', label: 'Security Broker', subtext: 'Sanitizer & PathGuard' },
    { value: '-70%', label: 'Ahorro TCO', subtext: 'Ollama Local + Cloud' },
    { value: '3x', label: 'Auto-Reflexión', subtext: 'Linters & Traceback' },
  ];

  return (
    <section className="relative pt-24 pb-28 md:pt-36 md:pb-40 overflow-hidden bg-transparent min-h-screen flex flex-col justify-center">
      {/* Blueprint Grid Atmosphere Layer */}
      <div className="absolute inset-0 blueprint-grid pointer-events-none opacity-50" />

      {/* Conic Spotlight Halo Top Center */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] conic-spotlight pointer-events-none opacity-60 -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          
          {/* Eyebrow Label with Flanked Fading Lines */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center gap-4 text-[var(--text-secondary)] font-mono text-[13px] tracking-[0.10em] uppercase select-none"
          >
            <div className="h-[1px] w-16 sm:w-28 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.15)] to-transparent" />
            <span>LOCAL-FIRST AGENTIC IDE · SPARTA AGENT</span>
            <div className="h-[1px] w-16 sm:w-28 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.15)] to-transparent" />
          </motion.div>

          {/* Full-Bleed Illuminated Wordmark */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, type: 'spring' }}
            className="relative flex items-center justify-center select-none"
          >
            {/* Wordmark behind-glow */}
            <div className="absolute w-[250px] h-[80px] sm:w-[450px] sm:h-[120px] rounded-full bg-[#98c0ef]/10 blur-[80px] -z-10 animate-pulse-slow" />
            <h1 className="text-7xl sm:text-[110px] md:text-[140px] font-medium font-display tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-b from-[#d8ecf8] to-[#98c0ef] py-1 select-none">
              SPARTA
            </h1>
          </motion.div>

          {/* Heading Description */}
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight font-display leading-[1.12] text-[var(--text-primary)] max-w-3xl mx-auto"
          >
            Un IDE Agéntico que planifica, ejecuta y se auto-corrige localmente.
          </motion.h2>

          {/* Subtitle in Moon Mist (#c7d3ea in dark, #3f3f46 in light) */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed max-w-2xl mx-auto font-normal"
          >
            Sin que tu código abandone tu máquina. Impulsado por{' '}
            <strong className="text-[var(--text-display)] font-semibold">Electron + React + Base UI</strong>,{' '}
            <strong className="text-[var(--text-display)] font-semibold">Runtime Agéntico Nativo</strong> en TypeScript para razonamiento autónomo y un{' '}
            <strong className="text-[var(--text-display)] font-semibold">Broker de Seguridad</strong> local.
          </motion.p>

          {/* Primary Ghost Pill Action CTA & Outlined Pill Button */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <a href="#quick-start" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2 px-8">
                <Play className="w-4 h-4 fill-current text-current" />
                <span>Empezar Quick Start</span>
                <ArrowRight className="w-4 h-4 text-current opacity-70" />
              </Button>
            </a>
            <a
              href="https://github.com/Naiker12/Sparta-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 px-7">
                <GithubIcon className="w-4 h-4" />
                <span>Ver en GitHub</span>
              </Button>
            </a>
          </motion.div>
        </div>

        {/* 3 Floating Glass Mockup Cards in Overlapping Fan (Fitted for Local IDE execution instead of Login) */}
        <div className="mt-20 max-w-5xl mx-auto relative h-[480px] sm:h-[450px] flex items-center justify-center select-none pt-12">
          
          {/* Card 1: Left Card (Tilted Left, Rust Security Broker Settings) */}
          <motion.div
            initial={{ opacity: 0, x: -80, rotate: -18, scale: 0.9 }}
            animate={{ opacity: 0.85, x: -140, rotate: -7, scale: 0.92 }}
            whileHover={{ 
              opacity: 1, 
              scale: 1, 
              rotate: 0, 
              x: -100, 
              zIndex: 30, 
              transition: { duration: 0.25 }
            }}
            className="absolute hidden md:flex flex-col justify-between w-[290px] h-[340px] rounded-[16px] bg-[rgba(5,6,15,0.97)] border border-[rgba(186,215,247,0.12)] p-6 shadow-2xl backdrop-blur-2xl transition-shadow hover:shadow-[#663af3]/10 hover:shadow-2xl z-10 origin-bottom"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(186,215,247,0.08)]">
                <span className="text-[11px] font-mono text-[#c7d3ea] tracking-wider uppercase">Políticas de Permisos</span>
                <div className="w-2 h-2 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
              <p className="text-xs text-[#9da7ba] leading-normal">
                El broker de seguridad intercepta accesos a terminales e I/O en tiempo real.
              </p>
              
              {/* Permission Matrix Toggles */}
              <div className="space-y-2 pt-2">
                <div className="w-full flex items-center justify-between px-4 py-2 rounded-full bg-[rgba(199,211,234,0.04)] border border-[rgba(186,215,247,0.08)] text-xs text-[#d1e4fa]">
                  <span className="font-mono text-[10px]">PermissionPolicy</span>
                  <Badge variant="accent" className="text-[9px] py-0 px-2">BUILD Mode</Badge>
                </div>
                <div className="w-full flex items-center justify-between px-4 py-2 rounded-full bg-[rgba(199,211,234,0.04)] border border-[rgba(186,215,247,0.08)] text-xs text-[#d1e4fa]">
                  <span className="font-mono text-[10px]">CommandSanitizer</span>
                  <span className="text-[#34d399] font-bold text-[10px]">ACTIVE</span>
                </div>
                <div className="w-full flex items-center justify-between px-4 py-2 rounded-full bg-[rgba(199,211,234,0.04)] border border-[rgba(186,215,247,0.08)] text-xs text-[#d1e4fa]">
                  <span className="font-mono text-[10px]">PathGuard Lock</span>
                  <span className="text-[#34d399] font-bold text-[10px]">ACTIVE</span>
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-[#9da7ba] flex items-center gap-1.5 pt-3 border-t border-[rgba(186,215,247,0.06)]">
              <Lock className="w-3.5 h-3.5 text-[#b6d9fc]" />
              <span>Protección activa en sandbox</span>
            </div>
          </motion.div>

          {/* Card 2: Center Card (Interactive, Local Task Runner Panel) */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute w-[330px] sm:w-[350px] h-[390px] rounded-[16px] bg-[rgba(5,6,15,0.97)] border border-[rgba(186,215,247,0.15)] p-6 sm:p-7 shadow-[inset_0_1px_1px_rgba(216,236,248,0.2),inset_0_24px_48px_rgba(168,216,245,0.06),0_32px_64px_rgba(0,0,0,0.6)] backdrop-blur-3xl z-20"
          >
            <div className="flex flex-col justify-between h-full">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(186,215,247,0.08)]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#663af3]" />
                    <span className="text-[11px] font-mono text-[#d8ecf8] tracking-wider uppercase font-semibold">Sparta Task Runner</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono border-[rgba(186,215,247,0.2)] bg-black/40">workspace: active</Badge>
                </div>

                <div className="space-y-3.5 pt-1">
                  {/* Custom Text Area for Prompt Input: 6px radius */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-[#c7d3ea] uppercase tracking-wider block">Tarea / Prompt del Agente</label>
                    <textarea
                      value={taskPrompt}
                      onChange={(e) => setTaskPrompt(e.target.value)}
                      rows={3}
                      className="w-full bg-[rgba(199,211,234,0.06)] text-white placeholder-[#c7d3ea]/40 text-xs rounded-[6px] px-3 py-2 border border-[rgba(186,215,247,0.12)] focus:border-[rgba(186,215,247,0.24)] focus:outline-none transition-colors resize-none font-sans leading-normal"
                    />
                  </div>

                  {/* Model Selector dropdown inside the task box */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-[#c7d3ea] uppercase tracking-wider block">Modelo de Lenguaje</label>
                    <div className="relative">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-[rgba(199,211,234,0.06)] text-white text-xs rounded-[6px] px-3 py-2.5 border border-[rgba(186,215,247,0.12)] focus:border-[rgba(186,215,247,0.24)] focus:outline-none transition-colors appearance-none font-mono cursor-pointer"
                      >
                        <option value="ollama-llama3" className="bg-[#05060f]">ollama / llama3 (local-first)</option>
                        <option value="gemini-2.5-flash" className="bg-[#05060f]">gemini-2.5-flash (cloud)</option>
                        <option value="claude-3.5-sonnet" className="bg-[#05060f]">claude-3.5-sonnet (cloud)</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#9da7ba]">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sole Chromatic Void Violet CTA Button: 6px radius, action trigger */}
              <div className="pt-4 border-t border-[rgba(186,215,247,0.06)]">
                <Button variant="violet" className="w-full h-11 text-xs">
                  <Play className="w-3.5 h-3.5 fill-current mr-2" />
                  <span>Ejecutar Plan Agéntico</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Right Card (Tilted Right, Agent Plan Execution Checklist) */}
          <motion.div
            initial={{ opacity: 0, x: 80, rotate: 18, scale: 0.9 }}
            animate={{ opacity: 0.85, x: 140, rotate: 7, scale: 0.92 }}
            whileHover={{ 
              opacity: 1, 
              scale: 1, 
              rotate: 0, 
              x: 100, 
              zIndex: 30, 
              transition: { duration: 0.25 }
            }}
            className="absolute hidden md:flex flex-col justify-between w-[290px] h-[340px] rounded-[16px] bg-[rgba(5,6,15,0.97)] border border-[rgba(186,215,247,0.12)] p-6 shadow-2xl backdrop-blur-2xl transition-shadow hover:shadow-[#663af3]/10 hover:shadow-2xl z-10 origin-bottom"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(186,215,247,0.08)]">
                <span className="text-[11px] font-mono text-[#c7d3ea] tracking-wider uppercase">Plan de Ejecución</span>
                <Badge variant="success" className="text-[8px] bg-indigo-500/10 border-indigo-500/30 text-indigo-400 py-0 px-1.5 rounded-[4px]">Plan: LListo</Badge>
              </div>
              <p className="text-xs text-[#9da7ba] leading-normal">
                Visualiza cada sub-tarea planificada antes de aplicar cambios locales.
              </p>

              {/* Task Checklist simulation */}
              <div className="space-y-2 pt-1 font-mono text-[10px] text-[#c7d3ea]">
                <div className="flex items-center gap-2 p-1.5 rounded bg-[rgba(199,211,234,0.04)]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate line-through text-[#9da7ba]">1. research_codebase</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-[rgba(199,211,234,0.04)]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate line-through text-[#9da7ba]">2. generate_plan.md</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-[rgba(199,211,234,0.06)] border border-[#663af3]/30">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />
                  <span className="truncate font-semibold text-white">3. run_linters_and_fix</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-black/20 text-[#9da7ba]">
                  <Wrench className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">4. verify_compilation</span>
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-[#9da7ba] flex items-center gap-1.5 pt-3 border-t border-[rgba(186,215,247,0.06)]">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Agent Runtime Traceback: OK</span>
            </div>
          </motion.div>

        </div>

        {/* Performance & Metrics Grid */}
        <div className="max-w-5xl mx-auto mt-16 md:mt-24 border-t border-[rgba(186,215,247,0.12)] pt-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 * idx }}
                className="p-6 sm:p-8 rounded-[16px] bg-[rgba(186,214,247,0.03)] border border-[rgba(186,215,247,0.12)] text-center backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(216,236,248,0.2),inset_0_12px_24px_rgba(168,216,245,0.02)] hover:border-[#663af3]/50 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(102,58,243,0.12)] transition-all duration-300 group flex flex-col justify-center"
              >
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-b from-[#d8ecf8] to-[#98c0ef] tracking-tight group-hover:scale-105 transition-transform duration-300">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm font-semibold text-[#d1e4fa] font-display mt-3 select-none">
                  {stat.label}
                </div>
                <div className="text-[10px] sm:text-xs text-[#9da7ba] font-mono mt-1 select-none">
                  {stat.subtext}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
