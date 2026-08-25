import React from 'react';

interface DiagramEmbedProps {
  src?: string;
  alt?: string;
  caption?: string;
  children?: React.ReactNode;
}

export function DiagramEmbed({ src, alt = 'Diagrama explicativo', caption, children }: DiagramEmbedProps) {
  return (
    <figure className="my-8 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60 p-4 sm:p-6 shadow-sm backdrop-blur-sm">
      <div className="flex w-full items-center justify-center">
        {src ? (
          <img src={src} alt={alt} className="w-full max-w-full rounded-xl object-contain" />
        ) : (
          children
        )}
      </div>
      {caption ? (
        <figcaption className="mt-3 text-center text-xs text-zinc-500 font-mono">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
