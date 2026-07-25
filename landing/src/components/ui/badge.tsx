import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'accent';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center rounded-[6px] px-2.5 py-0.5 text-[12px] font-mono font-medium tracking-wide transition-all focus:outline-none';

  const variants = {
    // AuthKit Luminous Fill: rgba(199,211,234,0.12) fill, #d1e4fa text, hairline border
    default: 'bg-[rgba(199,211,234,0.12)] text-[#d1e4fa] border border-[rgba(186,215,247,0.12)]',
    secondary: 'bg-[rgba(47,52,62,0.6)] text-[#c7d3ea] border border-[rgba(186,215,247,0.12)]',
    outline: 'bg-transparent text-[#d1e4fa] border border-[rgba(186,215,247,0.12)]',
    success: 'bg-[rgba(16,185,129,0.15)] text-[#34d399] border border-[rgba(16,185,129,0.3)] font-semibold',
    warning: 'bg-[rgba(245,158,11,0.15)] text-[#fbbf24] border border-[rgba(245,158,11,0.3)] font-semibold',
    accent: 'bg-[rgba(102,58,243,0.2)] text-[#d1e4fa] border border-[rgba(102,58,243,0.4)] font-semibold shadow-xs',
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  );
}

export { Badge };
