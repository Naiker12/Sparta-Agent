import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { SectionHeader } from '../ui/section-header';
import { Code, Search, Workflow, Database, CheckSquare, Sparkles } from 'lucide-react';

export function SkillsEcosystem() {
  const categories = [
    {
      name: 'Coding & Refactoring',
      icon: Code,
      badge: 'core/coding',
      skills: ['React 18', 'TypeScript', 'Python', 'Rust', 'Go', 'Design Systems', 'Clean Architecture'],
      color: 'text-indigo-400 bg-indigo-500/5 border-indigo-500/15',
    },
    {
      name: 'Research & Search',
      icon: Search,
      badge: 'core/research',
      skills: ['Web Search', 'Doc Indexing', 'Codebase Mapping', 'Dependency Audit'],
      color: 'text-sky-400 bg-sky-500/5 border-sky-500/15',
    },
    {
      name: 'Automation & CI/CD',
      icon: Workflow,
      badge: 'core/automation',
      skills: ['Git Workflows', 'GitHub Actions', 'Test Runners', 'Docker Build', 'Release Scripts'],
      color: 'text-amber-400 bg-amber-500/5 border-amber-500/15',
    },
    {
      name: 'Data Science & SQL',
      icon: Database,
      badge: 'core/data-science',
      skills: ['SQL Optimization', 'Pandas Analysis', 'Data Viz', 'Schema Migrations'],
      color: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/15',
    },
    {
      name: 'Productivity & Planning',
      icon: CheckSquare,
      badge: 'core/productivity',
      skills: ['Task Breakdown', 'Plan Generation', 'Tech Specs', 'Walkthrough Writer'],
      color: 'text-purple-400 bg-purple-500/5 border-purple-500/15',
    },
    {
      name: 'UI Components & shadcn',
      icon: Sparkles,
      badge: 'skills/shadcn',
      skills: ['Base UI', 'shadcn/ui', 'base-nova preset', 'Tailwind v4', 'Aesthetic Polish'],
      color: 'text-rose-400 bg-rose-500/5 border-rose-500/15',
    },
  ];

  return (
    <section id="skills" className="py-24 md:py-32 relative bg-transparent border-y border-[rgba(186,215,247,0.12)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Unified Section Header */}
        <SectionHeader
          eyebrow="Ecosistema de Habilidades"
          title="Ecosistema Extensible de Skills"
          description="Extiende la inteligencia del agente agregando carpetas en .agents/skills/ con instrucciones en Markdown y scripts de apoyo locales."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Card key={cat.name} className="border-[rgba(186,215,247,0.12)] bg-[rgba(186,214,247,0.02)] p-6 space-y-4 hover:border-indigo-500/40 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg border ${cat.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold font-display text-[#d8ecf8]">
                      {cat.name}
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {cat.badge}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {cat.skills.map((skill) => (
                    <span
                      key={skill}
                      className="text-xs font-mono font-medium px-3 py-1 rounded-[6px] bg-[#05060f] border border-[rgba(186,215,247,0.08)] text-[#d1e4fa] hover:border-indigo-500/40 transition-colors cursor-default"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
