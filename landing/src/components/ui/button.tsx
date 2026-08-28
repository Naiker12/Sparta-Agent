import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'coral';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none';

    const variants = {
      // Raycast Neutral Filled Action (Mist fill #e6e6e6, Iron text #454647)
      default:
        'bg-[#e6e6e6] hover:bg-white text-[#454647] hover:text-[#111214] rounded-lg shadow-button-neutral font-medium active:scale-[0.98]',
      // Ghost link / button (Ash text #9c9c9d, Pure White hover)
      ghost:
        'bg-transparent hover:bg-white/5 text-[#9c9c9d] hover:text-white rounded-lg active:scale-[0.98]',
      // Hairline Outlined Button
      outline:
        'bg-transparent hover:bg-white/[0.04] text-white border border-[#363739] hover:border-white/20 rounded-lg active:scale-[0.98]',
      // Elevated Dark Surface Button (Graphite #1b1c1e)
      secondary:
        'bg-[#1b1c1e] hover:bg-[#252629] text-white border border-[#363739] rounded-lg shadow-key active:scale-[0.98]',
      // Brand Coral Action
      coral:
        'bg-[#ff6363] hover:bg-[#ff7575] text-white rounded-lg shadow-[0_0_20px_rgba(255,99,99,0.35)] active:scale-[0.98]',
    };

    const sizes = {
      default: 'h-9 px-4 text-xs tracking-tight',
      sm: 'h-8 px-3 text-xs tracking-tight',
      lg: 'h-11 px-6 text-sm tracking-tight',
      icon: 'h-9 w-9 p-0 rounded-lg',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
