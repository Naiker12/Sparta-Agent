import React, { useState } from 'react';
import { SectionHeader } from '../ui/section-header';
import {
  Folder,
  Zap,
} from 'lucide-react';
import {
  NotionIcon,
  OneDriveIcon,
  GoogleDriveIcon,
  GmailIcon,
  SlackIcon,
  SupabaseIcon,
} from '../icons/mcp-brand-icons';

export function SkillsEcosystem() {
  const [selectedSkill, setSelectedSkill] = useState('shadcn');

  const categories = [
    {
      id: 'shadcn',
      name: 'UI Components & shadcn',
      icon: NotionIcon,
      badge: 'skills/shadcn',
      desc: 'Gestión de componentes UI, presets base-nova y tokens.',
      skills: ['Base UI', 'shadcn/ui', 'base-nova preset', 'Tailwind CSS'],
      badgeColor: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
      sampleFile: '.agents/skills/shadcn/SKILL.md',
      yamlFrontmatter: `---
name: shadcn
description: Manages shadcn UI components & design tokens.
---
# Instructions
1. Use Base UI primitive components with Tailwind CSS.
2. Maintain accessible ARIA roles & dark micro-animations.`,
    },
    {
      id: 'coding',
      name: 'Coding & Architecture',
      icon: SupabaseIcon,
      badge: 'skills/coding',
      desc: 'Principios SOLID, refactorización limpia en TypeScript.',
      skills: ['React 18', 'TypeScript', 'FastAPI', 'Rust', 'Go'],
      badgeColor: 'border-[#663af3]/30 text-[#a855f7] bg-[#663af3]/10',
      sampleFile: '.agents/skills/coding/SKILL.md',
      yamlFrontmatter: `---
name: clean-code
description: Enforces clean architecture & strict typing.
---
# Rules
1. Zero runtime inferencing; declare strict return types.
2. Decouple domain models from external API handlers.`,
    },
    {
      id: 'research',
      name: 'Research & RAG Vector Search',
      icon: GoogleDriveIcon,
      badge: 'skills/research',
      desc: 'Búsqueda sintáctica ripgrep y vectorstore ChromaDB.',
      skills: ['Web Search', 'Doc Indexing', 'Codebase Mapping', 'ChromaDB'],
      badgeColor: 'border-sky-500/30 text-sky-400 bg-sky-500/10',
      sampleFile: '.agents/skills/research/SKILL.md',
      yamlFrontmatter: `---
name: rag-search
description: Deep codebase indexer & RAG assistant.
---
# Indexing Protocol
1. Scan workspace root for AGENTS.md directives.
2. Query ChromaDB local vector store before code edits.`,
    },
    {
      id: 'automation',
      name: 'Automation & CI/CD Pipelines',
      icon: SlackIcon,
      badge: 'skills/automation',
      desc: 'Flujos automatizados de GitHub Actions y despliegues.',
      skills: ['Git Workflows', 'GitHub Actions', 'Test Harness', 'Docker'],
      badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
      sampleFile: '.agents/skills/automation/SKILL.md',
      yamlFrontmatter: `---
name: cicd-runner
description: Automated test runners & deployment pipelines.
---
# Execution Rules
1. Execute test harness before marking tasks done.
2. Emit transparent walkthrough.md summary report.`,
    },
    {
      id: 'data',
      name: 'Data Science & Databases',
      icon: OneDriveIcon,
      badge: 'skills/data-science',
      desc: 'Optimización SQL y análisis de datos con Pandas.',
      skills: ['SQL Optimization', 'Pandas Analysis', 'PostgreSQL', 'SQLite'],
      badgeColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
      sampleFile: '.agents/skills/data/SKILL.md',
      yamlFrontmatter: `---
name: db-optimizer
description: PostgreSQL query planner & migration builder.
---
# Schema Guidelines
1. Always generate reversible SQL migration scripts.
2. Audit foreign key constraints and index speed.`,
    },
    {
      id: 'productivity',
      name: 'Productivity & Planning',
      icon: GmailIcon,
      badge: 'skills/productivity',
      desc: 'Desglose dinámico de tareas en planes Markdown.',
      skills: ['Task Breakdown', 'Plan Generation', 'Tech Specs', 'Walkthrough'],
      badgeColor: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
      sampleFile: '.agents/skills/productivity/SKILL.md',
      yamlFrontmatter: `---
name: planner-pro
description: Automatic task breakdown & plan generator.
---
# Planning Protocol
1. Create implementation_plan.md before code edits.
2. Request user review on high-risk decisions.`,
    },
  ];

  const currentSkill = categories.find((c) => c.id === selectedSkill) || categories[0];

  return (
    <section id="skills" className="py-12 relative bg-slate-50/85 dark:bg-[#07050d]/85 backdrop-blur-md text-slate-900 dark:text-white border-y border-slate-200 dark:border-white/10 font-sans transition-colors duration-300">
      {/* Ambient Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-[#663af3]/10 blur-[130px] pointer-events-none" />

      {/* UNIFIED CONTINUOUS GRID CONTAINER MAX-W-7XL BORDER-X */}
      <div className="mx-auto max-w-7xl border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <SectionHeader
          eyebrow="ECOSISTEMA EXTENSIBLE // AGENTS SKILLS"
          title="Ecosistema Extensible de Skills"
          description="Extiende la inteligencia del agente agregando carpetas en .agents/skills/ con instrucciones en Markdown y scripts de apoyo locales."
        />

        {/* COMPACT INTERACTIVE SKILLS HUBS & CODE PREVIEW GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-8 items-stretch max-w-5xl mx-auto">
          {/* Left Side: 6 Skills Bento Cards (7 Cols) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedSkill === cat.id;
              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedSkill(cat.id)}
                  className={`p-3.5 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                    isSelected
                       ? 'bg-[#663af3]/15 border-[#663af3] text-slate-900 dark:text-white shadow-lg shadow-[#663af3]/20 scale-[1.02]'
                       : 'bg-white dark:bg-[#0e0b16]/80 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300 hover:border-slate-300 dark:hover:border-white/25 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono border ${cat.badgeColor}`}>
                        {cat.badge}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">{cat.name}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-tight mb-2 line-clamp-2">{cat.desc}</p>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-200 dark:border-white/10">
                    {cat.skills.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300"
                      >
                        {skill}
                      </span>
                    ))}
                    {cat.skills.length > 3 && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400">
                        +{cat.skills.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Side: Live SKILL.md Folder & Code Preview Box (5 Cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-[#030206] border border-slate-200 dark:border-white/15 rounded-2xl p-4 backdrop-blur-xl flex flex-col justify-between shadow-lg dark:shadow-xl relative h-full">
            <div>
              {/* Folder & File Path Bar */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-white/10 font-mono text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-gray-300 truncate">
                  <Folder className="w-3.5 h-3.5 text-[#a855f7] shrink-0" />
                  <span className="text-slate-900 dark:text-white font-bold text-[11px] truncate">{currentSkill.sampleFile}</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  YAML FRONTMATTER
                </span>
              </div>

              {/* Code Snippet Box with word wrap */}
              <div className="bg-slate-50 dark:bg-[#080512] border border-slate-200 dark:border-white/10 rounded-xl p-3 font-mono text-xs text-slate-700 dark:text-gray-200 leading-relaxed mb-3">
                <pre className="text-purple-700 dark:text-purple-300 text-[10.5px] whitespace-pre-wrap break-words font-mono">
                  <code>{currentSkill.yamlFrontmatter}</code>
                </pre>
              </div>

              {/* Active Skill Summary Info */}
              <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-xl p-3 font-mono text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold text-[11px]">
                  <Zap className="w-3.5 h-3.5 text-[#a855f7]" />
                  <span>Detección Automática</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 leading-tight">
                  Las carpetas en <code className="text-purple-700 dark:text-purple-300 font-mono">.agents/skills/</code> se cargan automáticamente sin registro manual.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-white/10 text-[10px] font-mono text-slate-500 dark:text-gray-400 flex items-center justify-between mt-3">
              <span>Formato Estándar:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">SKILL.md + Scripts</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
