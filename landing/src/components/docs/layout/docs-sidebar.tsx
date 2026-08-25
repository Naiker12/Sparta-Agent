import { Github } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { navigation } from '../content/docs-nav.config';

interface DocsSidebarProps {
  currentPage: string;
  docsHref: (slug?: string) => string;
}

export function DocsSidebar({ currentPage, docsHref }: DocsSidebarProps) {
  return (
    <aside
      aria-label="Navegación de documentación"
      className="hidden h-[calc(100vh-4rem)] overflow-y-auto border-r border-white/10 px-5 py-8 lg:sticky lg:top-16 lg:block"
    >
      <div>
        <p className="mb-5 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Documentación
        </p>
        <div className="flex flex-col gap-6">
          {navigation.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                {group.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = currentPage === item.slug;
                  return (
                    <a
                      key={item.label}
                      href={docsHref(item.slug)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'rounded-md border-l-2 px-2 py-1.5 text-sm transition',
                        isActive
                          ? 'border-white bg-white/10 font-medium text-white'
                          : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <Separator className="my-6 bg-white/10" />
        <a
          href="https://github.com/Naiker12/Sparta-Agent"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <Github className="size-4" /> Código fuente
        </a>
      </div>
    </aside>
  );
}
