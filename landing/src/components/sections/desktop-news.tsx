import { ArrowUpRight, Folder, MessageSquare, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { desktopNews, currentRelease } from '../../lib/desktop-news';

const icons = [MessageSquare, SlidersHorizontal, Folder, ShieldCheck];

export function DesktopNews() {
  return <section id="novedades" aria-labelledby="desktop-news-title" className="relative mx-auto max-w-7xl scroll-mt-24 px-6 py-24">
    <div className="mb-10 max-w-2xl">
      <span className="inline-flex rounded-full border border-[#63a1ff]/25 bg-[#63a1ff]/10 px-3 py-1 text-xs font-medium text-[#63a1ff]">En preparación · Sparta Desktop</span>
      <h2 id="desktop-news-title" className="mt-5 text-3xl font-medium tracking-tight text-white md:text-4xl">{desktopNews.title}</h2>
      <p className="mt-4 text-base leading-relaxed text-[#9c9c9d]">{desktopNews.description}</p>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {desktopNews.features.map((feature, index) => {
        const Icon = icons[index];
        return <article key={feature.title} className="rounded-2xl border border-[#363739] bg-[#07080a] p-6">
          <Icon className="mb-5 size-5 text-[#63a1ff]" aria-hidden="true" />
          <h3 className="text-lg font-medium text-white">{feature.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#9c9c9d]">{feature.summary}</p>
          <ul className="mt-5 space-y-2 text-sm leading-relaxed text-[#9c9c9d]">
            {feature.details.map(detail => <li key={detail} className="flex gap-2"><span className="text-[#63a1ff]" aria-hidden="true">·</span>{detail}</li>)}
          </ul>
        </article>;
      })}
    </div>
    <p className="mt-7 text-sm leading-relaxed text-[#9c9c9d]">La descarga disponible es v{currentRelease.version}. Consulta los cambios de esa versión antes de instalarla. <a className="inline-flex items-center gap-1 text-white underline underline-offset-4" href={currentRelease.url} target="_blank" rel="noopener noreferrer">Ver versión publicada<ArrowUpRight className="size-3.5" /></a></p>
  </section>;
}
