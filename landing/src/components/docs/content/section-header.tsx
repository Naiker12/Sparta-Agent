import React from 'react';

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function SectionHeader({ eyebrow, title, description, children }: SectionHeaderProps) {
  return (
    <div>
      <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-2xl leading-7 text-zinc-400">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
