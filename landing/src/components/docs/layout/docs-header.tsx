import React from 'react';
import { Github, Menu } from 'lucide-react';
import { getPublicUrl } from '@/lib/utils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface DocsHeaderProps {
  onHomeClick: (e: React.MouseEvent) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  docsHref: (slug?: string) => string;
}

export function DocsHeader({
  onHomeClick,
  menuOpen,
  onToggleMenu,
  docsHref,
}: DocsHeaderProps) {
  const favicon = getPublicUrl('favicon.svg');

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href={getPublicUrl('')}
                onClick={onHomeClick}
                className="flex items-center gap-2.5 font-semibold tracking-tight text-white hover:text-amber-300 transition-colors"
              >
                <img src={favicon} alt="Sparta Agent" className="size-7" />
                <span>Sparta Agent</span>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-gray-400">Docs</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="hidden items-center gap-5 text-sm text-gray-300 md:flex">
          <button
            onClick={onHomeClick}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            ← Volver a la Landing
          </button>
          <a href={docsHref('instalacion')} className="hover:text-white transition-colors">
            Guía
          </a>
          <a href={docsHref('arquitectura')} className="hover:text-white transition-colors">
            Arquitectura
          </a>
          <a href={docsHref('permisos')} className="hover:text-white transition-colors">
            Seguridad
          </a>
          <a
            href="https://github.com/Naiker12/Sparta-Agent"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-white transition hover:bg-white/10"
          >
            <Github className="size-4" /> GitHub
          </a>
        </div>
        <button
          aria-label="Abrir navegación"
          onClick={onToggleMenu}
          className="rounded-md p-2 text-gray-400 hover:text-white md:hidden"
        >
          <Menu className="size-5" />
        </button>
      </div>
    </header>
  );
}
