import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'coral' | 'accent';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const baseStyles =
    'inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-mono font-medium tracking-wide transition-all focus:outline-none select-none';

  const variants = {
    // Raycast Graphite Badge
    default: 'bg-[#1b1c1e] text-white border border-[#363739]',
    secondary: 'bg-[#111214] text-[#9c9c9d] border border-white/5',
    outline: 'bg-transparent text-[#9c9c9d] border border-[#363739]',
    success: 'bg-[#0b2014] text-[#59d499] border border-[#59d499]/30 font-medium',
    warning: 'bg-[#291a05] text-[#fbbf24] border border-[#fbbf24]/30 font-medium',
    coral: 'bg-[#452324] text-[#ff6363] border border-[#ff6363]/30 font-medium',
    accent: 'bg-[#452324] text-[#ff6363] border border-[#ff6363]/30 font-medium',
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  );
}

export { Badge };
