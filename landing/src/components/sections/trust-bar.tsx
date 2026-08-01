import React from 'react';
import { motion } from 'framer-motion';
import { Folder, GitBranch, Globe } from 'lucide-react';
import {
  NotionIcon,
  OneDriveIcon,
  GoogleDriveIcon,
  GmailIcon,
  GoogleCalendarIcon,
  SlackIcon,
  SupabaseIcon,
} from '../icons/mcp-brand-icons';

export function TrustBar() {
  const integrations = [
    { name: 'Notion', icon: NotionIcon, color: '#a855f7', tools: '7 Herramientas' },
    { name: 'OneDrive', icon: OneDriveIcon, color: '#0078d4', tools: '5 Herramientas' },
    { name: 'Google Drive', icon: GoogleDriveIcon, color: '#34a853', tools: '3 Herramientas' },
    { name: 'Gmail', icon: GmailIcon, color: '#ea4335', tools: '11 Herramientas' },
    { name: 'Google Calendar', icon: GoogleCalendarIcon, color: '#4285f4', tools: '3 Herramientas' },
    { name: 'Filesystem', icon: Folder, color: '#10b981', tools: '5 Herramientas' },
    { name: 'GitHub', icon: GitBranch, color: '#ec4899', tools: '4 Herramientas' },
    { name: 'Slack', icon: SlackIcon, color: '#e01e5a', tools: '3 Herramientas' },
    { name: 'Supabase', icon: SupabaseIcon, color: '#3ecf8e', tools: '2 Herramientas' },
    { name: 'Playwright', icon: Globe, color: '#06b6d4', tools: '3 Herramientas' },
  ];

  const marqueeIntegrations = [...integrations, ...integrations];

  return (
    <div className="border-y border-slate-200 dark:border-white/10 bg-slate-50/85 dark:bg-[#07050d]/85 backdrop-blur-md py-8 overflow-hidden font-sans transition-colors duration-300">
      <div className="mx-auto max-w-7xl border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-gray-400 mb-6 font-bold">
          Integración Nativa con Conectores MCP (Standard SVGL)
        </p>

        {/* Infinite Marquee Loop Carousel */}
        <div className="relative overflow-hidden w-full [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{
              repeat: Infinity,
              repeatType: 'loop',
              duration: 25,
              ease: 'linear',
            }}
            className="flex items-center gap-4 w-max"
          >
            {marqueeIntegrations.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.name}-${idx}`}
                  className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-3.5 flex items-center gap-3 backdrop-blur-md hover:border-slate-300 dark:hover:border-white/25 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all duration-200 shrink-0 w-52 shadow-sm"
                >
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0 bg-slate-50 dark:bg-white/[0.03]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</h4>
                    <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono block truncate font-medium">
                      {item.tools}
                    </span>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
