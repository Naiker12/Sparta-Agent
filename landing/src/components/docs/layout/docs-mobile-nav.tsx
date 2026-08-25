import React from 'react';

interface DocsMobileNavProps {
  open: boolean;
  onHomeClick: (e: React.MouseEvent) => void;
  docsHref: (slug?: string) => string;
}

export function DocsMobileNav({ open, onHomeClick, docsHref }: DocsMobileNavProps) {
  if (!open) return null;

  return (
    <nav className="border-b border-white/10 px-5 py-4 text-sm md:hidden bg-black/95 backdrop-blur-xl">
      <div className="flex flex-col gap-3">
        <button onClick={onHomeClick} className="text-left text-amber-300 py-1 font-medium">
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
          className="hover:text-white transition-colors"
        >
          GitHub
        </a>
      </div>
    </nav>
  );
}
