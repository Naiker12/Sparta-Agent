import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'accent';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center rounded-full px-3 py-0.5 text-xs font-mono font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

  const variants = {
    default: 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white shadow-xs',
    secondary: 'bg-zinc-200 text-zinc-900 border border-zinc-300 dark:bg-zinc-800/90 dark:text-zinc-100 dark:border-zinc-700 font-medium',
    outline: 'text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 font-medium',
    success: 'bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40 font-semibold',
    warning: 'bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 font-semibold',
    accent: 'bg-indigo-100 text-indigo-950 border border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-500/50 font-bold shadow-xs',
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  );
}

export { Badge };
