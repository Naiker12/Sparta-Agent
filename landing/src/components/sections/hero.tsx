import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Play, ArrowRight, Lock, Zap, Terminal, Sparkles, CheckCircle2, ShieldCheck, Cpu, Code2, Bot, CornerDownLeft } from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';
import { motion, AnimatePresence } from 'framer-motion';

export function Hero() {
  const [promptText, setPromptText] = useState('');
  const sampleTasks = [
    'Implementa autenticación JWT con FastAPI y prueba los endpoints...',
    'Crea tests unitarios para la capa de permisos en Rust...',
    'Refactoriza el estado global de React usando Zustand y TypeScript...',
  ];
  const [taskIndex, setTaskIndex] = useState(0);

  useEffect(() => {
    let currentTask = sampleTasks[taskIndex];
    let i = 0;
    const interval = setInterval(() => {
      if (i <= currentTask.length) {
        setPromptText(currentTask.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setTaskIndex((prev) => (prev + 1) % sampleTasks.length);
        }, 3000);
      }
    }, 45);
    return () => clearInterval(interval);
  }, [taskIndex]);

  return (
    <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
      {/* Dynamic Background Mesh Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-transparent blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-1/4 w-[350px] h-[250px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Badge indicator with HIGH CONTRAST */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2"
          >
            <Badge variant="accent" className="px-4 py-1.5 text-xs gap-2 shadow-sm border border-indigo-500/30">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-semibold">Local-First Agentic IDE · v0.1 Production Ready</span>
            </Badge>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[var(--text-display)] font-display leading-[1.08]"
          >
            Un IDE Agéntico que{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-indigo-400 to-purple-400">
              planifica, ejecuta y se corrige.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-[var(--text-secondary)] leading-relaxed max-w-3xl mx-auto font-normal"
          >
            Sin que tu código abandone tu máquina. Impulsado por{' '}
            <strong className="text-[var(--text-display)] font-semibold">Electron + React</strong> en el frontend,{' '}
            <strong className="text-[var(--text-display)] font-semibold">LangGraph</strong> en Python para razonamiento autónomo y un{' '}
            <strong className="text-[var(--text-display)] font-semibold">Broker de Seguridad</strong> nativo en Rust.
          </motion.p>

          {/* Key Quick Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-wrap justify-center items-center gap-3 text-xs font-mono text-[var(--text-secondary)] pt-2"
          >
            <span className="flex items-center gap-1.5 bg-[var(--bg-surface)] px-3.5 py-1.5 rounded-lg border border-[var(--border-normal)] shadow-xs">
              <Lock className="w-3.5 h-3.5 text-emerald-500" /> 100% Perímetro Local Privado
            </span>
            <span className="flex items-center gap-1.5 bg-[var(--bg-surface)] px-3.5 py-1.5 rounded-lg border border-[var(--border-normal)] shadow-xs">
              <Zap className="w-3.5 h-3.5 text-indigo-500" /> TCO -70% Multi-Modelo (Ollama + Cloud)
            </span>
            <span className="flex items-center gap-1.5 bg-[var(--bg-surface)] px-3.5 py-1.5 rounded-lg border border-[var(--border-normal)] shadow-xs">
              <Terminal className="w-3.5 h-3.5 text-purple-500" /> Bucle Plan → Act → Reflect
            </span>
          </motion.div>

          {/* Action CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <a href="#quick-start" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2 px-8 py-3 font-semibold shadow-lg shadow-indigo-500/20">
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
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 px-7 py-3 font-semibold">
                <GithubIcon className="w-4 h-4" />
                <span>Ver en GitHub</span>
              </Button>
            </a>
          </motion.div>
        </div>

        {/* Hero Interactive Sparta IDE Mockup Window */}
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-14 max-w-5xl mx-auto relative group"
        >
          {/* Glowing Aura Frame */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500/30 via-purple-500/20 to-indigo-500/30 blur-xl opacity-75 group-hover:opacity-100 transition duration-500" />

          {/* Window Shell Frame */}
          <div className="relative rounded-2xl border border-[var(--border-strong)] bg-[#0C0C10] overflow-hidden shadow-2xl backdrop-blur-md">
            {/* Titlebar */}
            <div className="bg-[#0F0F14] px-4 py-3 border-b border-[var(--border-normal)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs font-mono text-[var(--text-muted)] hidden sm:inline">
                  Sparta Agent — [BUILD MODE] ~/projects/sparta-agent
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" /> Rust Broker: Active
                </span>
                <span className="text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded border border-purple-500/30 hidden md:inline">
                  Ollama / Claude 3.5
                </span>
              </div>
            </div>

            {/* Mockup Workspace Area (matching post.png design) */}
            <div className="p-6 md:p-10 space-y-8 bg-[#0C0C10] min-h-[380px] flex flex-col justify-between">
              {/* Sparta Helmet Header Brand Center */}
              <div className="text-center space-y-3 pt-4">
                <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Bot className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold font-display tracking-wider text-white">
                  SPARTA AGENT
                </h3>
                <p className="text-xs font-mono text-[var(--text-muted)] max-w-lg mx-auto">
                  Describe tu tarea. Elegiré las herramientas, explicaré el plan y confirmaré contigo antes de acciones de riesgo.
                </p>
              </div>

              {/* Sample Action Prompt Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                <div className="p-3 rounded-xl bg-[#131318] border border-[var(--border-normal)] hover:border-indigo-500/50 transition-all text-xs font-mono text-zinc-300 flex items-center justify-between cursor-pointer group">
                  <span className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-indigo-400" /> Escribe tests unitarios para FastAPI
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="p-3 rounded-xl bg-[#131318] border border-[var(--border-normal)] hover:border-indigo-500/50 transition-all text-xs font-mono text-zinc-300 flex items-center justify-between cursor-pointer group">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" /> Refactoriza el estado en React
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 transition-colors" />
                </div>
              </div>

              {/* Animated Prompt Bar */}
              <div className="max-w-2xl mx-auto w-full bg-[#16161C] border border-indigo-500/40 rounded-xl p-3.5 shadow-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs font-mono text-zinc-200 flex-1">
                  <span className="text-indigo-400 font-bold">$</span>
                  <span className="text-white font-medium">{promptText}</span>
                  <span className="w-2 h-4 bg-indigo-400 animate-pulse" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30">
                    Plan Ready
                  </span>
                  <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
