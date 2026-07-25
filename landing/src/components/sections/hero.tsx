import { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Play, ArrowRight, Lock, Zap, Terminal, ShieldCheck } from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';
import { motion } from 'framer-motion';

export function Hero() {
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');

  const stats = [
    { value: '100%', label: 'Perímetro Local Privado', subtext: 'GDPR / CCPA / Air-Gapped' },
    { value: '< 15ms', label: 'Overhead Broker Rust', subtext: 'CommandSanitizer & PathGuard' },
    { value: '-70%', label: 'Reducción de TCO', subtext: 'Ollama Local + Multi-Cloud' },
    { value: '3x Retry', label: 'Bucle Auto-Corrección', subtext: 'Diagnostic Linters & Traceback' },
  ];

  return (
    <section className="relative pt-32 pb-24 md:pt-44 md:pb-36 overflow-hidden bg-[#05060f]">
      {/* Blueprint Grid Atmosphere Layer */}
      <div className="absolute inset-0 blueprint-grid pointer-events-none opacity-60" />

      {/* Conic Spotlight Halo Top Center */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] conic-spotlight pointer-events-none opacity-70 -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          
          {/* Section Eyebrow Label with Flanked Fading Lines (AuthKit Spec) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center gap-4 text-[#c7d3ea] font-mono text-[13px] tracking-[0.10em] uppercase"
          >
            <div className="h-[1px] w-16 sm:w-28 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.25)] to-transparent" />
            <span>LOCAL-FIRST AGENTIC IDE · SPARTA AGENT</span>
            <div className="h-[1px] w-16 sm:w-28 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.25)] to-transparent" />
          </motion.div>

          {/* Headline with Skywash Ice Highlight Gradient */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight font-display leading-[1.08] text-transparent bg-clip-text bg-gradient-to-b from-[#d8ecf8] to-[#98c0ef]"
          >
            Un IDE Agéntico que planifica, ejecuta y se auto-corrige.
          </motion.h1>

          {/* Subtitle in Moon Mist (#c7d3ea) */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-[#c7d3ea] leading-relaxed max-w-3xl mx-auto font-normal"
          >
            Sin que tu código abandone tu máquina. Impulsado por{' '}
            <strong className="text-[#ffffff] font-semibold">Electron + React</strong> en el frontend,{' '}
            <strong className="text-[#ffffff] font-semibold">LangGraph</strong> en Python para razonamiento autónomo y un{' '}
            <strong className="text-[#ffffff] font-semibold">Broker de Seguridad</strong> nativo en Rust.
          </motion.p>

          {/* Trust Metric Tags */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-wrap justify-center items-center gap-3 text-xs font-mono text-[#d1e4fa] pt-1"
          >
            <span className="flex items-center gap-2 bg-[rgba(186,214,247,0.04)] px-4 py-2 rounded-[999px] border border-[rgba(186,215,247,0.12)]">
              <Lock className="w-4 h-4 text-[#34d399]" /> 100% Perímetro Local Privado
            </span>
            <span className="flex items-center gap-2 bg-[rgba(186,214,247,0.04)] px-4 py-2 rounded-[999px] border border-[rgba(186,215,247,0.12)]">
              <Zap className="w-4 h-4 text-[#b6d9fc]" /> TCO -70% Multi-Modelo (Ollama + Cloud)
            </span>
            <span className="flex items-center gap-2 bg-[rgba(186,214,247,0.04)] px-4 py-2 rounded-[999px] border border-[rgba(186,215,247,0.12)]">
              <Terminal className="w-4 h-4 text-[#663af3]" /> Bucle Plan → Act → Reflect
            </span>
          </motion.div>

          {/* Action CTAs: Void Violet (#663af3) Primary CTA + Ghost Pill Button */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3"
          >
            <a href="#quick-start" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2 px-8 py-3.5 text-base font-medium bg-[#663af3] hover:bg-[#5b31e0] text-white rounded-full shadow-xl shadow-[#663af3]/30">
                <Play className="w-4 h-4 fill-current" />
                <span>Empezar Quick Start</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <a
              href="https://github.com/Naiker12/Sparta-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="ghost" size="lg" className="w-full sm:w-auto gap-2 px-7 py-3.5 text-base font-medium">
                <GithubIcon className="w-4 h-4" />
                <span>Ver en GitHub</span>
              </Button>
            </a>
          </motion.div>
        </div>

        {/* Auth-Form Modal Card Style Hero Showcase Frame */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-14 max-w-6xl mx-auto relative group"
        >
          {/* Ambient Backlight Halo */}
          <div className="absolute -inset-2 rounded-[24px] bg-gradient-to-r from-[#663af3]/25 via-[#b6d9fc]/15 to-[#663af3]/25 blur-2xl opacity-75 group-hover:opacity-100 transition duration-500" />

          {/* Glass Modal Card Container */}
          <div className="relative rounded-[16px] bg-[rgba(5,6,15,0.97)] border border-[rgba(186,215,247,0.12)] overflow-hidden shadow-[inset_0_1px_1px_rgba(216,236,248,0.2),inset_0_24px_48px_rgba(168,216,245,0.06),0_24px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            
            {/* Titlebar Header */}
            <div className="bg-[#080914] px-5 py-3 border-b border-[rgba(186,215,247,0.12)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs font-mono text-[#c7d3ea] font-medium hidden sm:inline">
                  Sparta Agent — [BUILD MODE] ~/projects/sparta-agent
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <Badge variant="success" className="py-0.5 px-2.5">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Rust Broker: Active
                </Badge>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-[#05060f] text-[#d8ecf8] border border-[rgba(186,215,247,0.12)] rounded px-2.5 py-1 text-[11px] font-mono cursor-pointer outline-none"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="ollama-llama3">ollama / llama3 (local)</option>
                  <option value="claude-3.5-sonnet">claude-3.5-sonnet</option>
                </select>
              </div>
            </div>

            {/* Interface Image Container */}
            <div className="relative aspect-[16/9] bg-[#05060f] overflow-hidden flex items-center justify-center p-2 sm:p-4">
              <img
                src="/post.png"
                alt="Sparta Agent Real Interface"
                className="w-full h-full object-contain rounded-xl shadow-2xl"
                loading="eager"
              />
            </div>
          </div>

          {/* Performance & Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 * idx }}
                className="p-5 rounded-[16px] bg-[rgba(186,214,247,0.03)] border border-[rgba(186,215,247,0.12)] text-center space-y-1 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(216,236,248,0.2)] hover:border-[#663af3]/50 transition-all"
              >
                <div className="text-2xl sm:text-3xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-b from-[#d8ecf8] to-[#98c0ef]">
                  {stat.value}
                </div>
                <div className="text-xs font-semibold text-[#d1e4fa] font-display">
                  {stat.label}
                </div>
                <div className="text-[11px] text-[#9da7ba] font-mono">
                  {stat.subtext}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
