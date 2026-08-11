import { useReducedMotion } from 'framer-motion';
import type { ElementType } from 'react';
import { getPublicUrl } from '../../lib/utils';
import {
  GmailIcon,
  GoogleCalendarIcon,
  GoogleDriveIcon,
  NotionIcon,
  OneDriveIcon,
  SlackIcon,
  SupabaseIcon,
} from '../icons/mcp-brand-icons';

type Integration = {
  name: string;
  tools: string;
  icon?: ElementType;
  logo?: string;
};

const integrations: Integration[] = [
  { name: 'Notion', icon: NotionIcon, tools: '7 herramientas' },
  { name: 'OneDrive', icon: OneDriveIcon, tools: '5 herramientas' },
  { name: 'Google Drive', icon: GoogleDriveIcon, tools: '3 herramientas' },
  { name: 'Gmail', icon: GmailIcon, tools: '11 herramientas' },
  { name: 'Google Calendar', icon: GoogleCalendarIcon, tools: '3 herramientas' },
  { name: 'Filesystem', logo: getPublicUrl('icons/brands/filesystem.svg'), tools: '5 herramientas' },
  { name: 'GitHub', logo: getPublicUrl('icons/brands/github.svg'), tools: '4 herramientas' },
  { name: 'Slack', icon: SlackIcon, tools: '3 herramientas' },
  { name: 'Supabase', icon: SupabaseIcon, tools: '2 herramientas' },
  { name: 'Playwright', logo: getPublicUrl('icons/brands/puppeteer.svg'), tools: '3 herramientas' },
];

function IntegrationCard({ integration }: { integration: Integration }) {
  const { name, tools, icon: Icon, logo } = integration;

  return (
    <li className="flex w-52 shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.06]">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
        {Icon ? <Icon className="size-5" aria-hidden="true" /> : <img src={logo} alt="" className="size-5 object-contain" />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{tools}</p>
      </div>
    </li>
  );
}

export function TrustBar() {
  const shouldReduceMotion = useReducedMotion();
  const items = shouldReduceMotion ? integrations : [...integrations, ...integrations];

  return (
    <section aria-labelledby="integrations-title" className="border-y border-slate-200 bg-white/80 py-9 transition-colors dark:border-white/10 dark:bg-[#09090b]/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-1 text-center">
          <h2 id="integrations-title" className="text-xl font-semibold tracking-tight text-[var(--text-display)]">Integraciones con identidad propia</h2>
        </div>

        {shouldReduceMotion ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {items.map((integration) => <IntegrationCard key={integration.name} integration={integration} />)}
          </ul>
        ) : (
          <div className="connector-marquee group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]" aria-label="Conectores disponibles">
            <ul className="connector-marquee-track flex w-max gap-3 py-1 group-hover:[animation-play-state:paused]">
              {items.map((integration, index) => <IntegrationCard key={`${integration.name}-${index}`} integration={integration} />)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
