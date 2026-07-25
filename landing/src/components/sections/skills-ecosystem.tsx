import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Code, Search, Workflow, Database, CheckSquare, Sparkles } from 'lucide-react';

export function SkillsEcosystem() {
  const categories = [
    {
      name: 'Coding & Refactoring',
      icon: Code,
      badge: 'core/coding',
      skills: ['React 18', 'TypeScript', 'Python', 'Rust', 'Go', 'Design Systems', 'Clean Architecture'],
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    {
      name: 'Research & Search',
      icon: Search,
      badge: 'core/research',
      skills: ['Web Search', 'Doc Indexing', 'Codebase Mapping', 'Dependency Audit'],
      color: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    },
    {
      name: 'Automation & CI/CD',
      icon: Workflow,
      badge: 'core/automation',
      skills: ['Git Workflows', 'GitHub Actions', 'Test Runners', 'Docker Build', 'Release Scripts'],
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    {
      name: 'Data Science & SQL',
      icon: Database,
      badge: 'core/data-science',
      skills: ['SQL Optimization', 'Pandas Analysis', 'Data Viz', 'Schema Migrations'],
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      name: 'Productivity & Planning',
      icon: CheckSquare,
      badge: 'core/productivity',
      skills: ['Task Breakdown', 'Plan Generation', 'Tech Specs', 'Walkthrough Writer'],
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    {
      name: 'UI Components & shadcn',
      icon: Sparkles,
      badge: 'skills/shadcn',
      skills: ['shadcn/ui', 'base-nova preset', 'Tailwind v4', 'Aesthetic Polish', 'Carousels'],
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    },
  ];

  return (
    <section id="skills" className="py-20 md:py-28 relative bg-[var(--bg-surface)] border-y border-[var(--border-normal)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge variant="accent" className="px-3.5 py-1 text-xs uppercase font-mono tracking-wider">
            Ecosistema de Habilidades
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-[var(--text-display)]">
            Ecosistema Extensible de Skills
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-secondary)]">
            Extiende la inteligencia del agente agregando carpetas en <code className="font-mono text-xs bg-[var(--bg-base)] px-2.5 py-1 rounded-md text-[var(--accent)] font-semibold border border-[var(--border-subtle)]">.agents/skills/</code> con instrucciones en Markdown y scripts de apoyo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Card key={cat.name} className="border-[var(--border-normal)] bg-[var(--bg-elevated)] p-6 space-y-4 hover:border-[var(--accent)] transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg border ${cat.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold font-display text-[var(--text-display)]">
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
                      className="text-xs font-mono font-semibold px-3 py-1 rounded-md bg-[var(--bg-base)] border border-[var(--border-normal)] text-[var(--text-primary)] hover:border-indigo-500/40 transition-colors"
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
