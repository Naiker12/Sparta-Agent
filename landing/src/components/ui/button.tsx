import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'violet';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181b] disabled:pointer-events-none disabled:opacity-50 cursor-pointer';

    const variants = {
      // Primary Ghost Pill using CSS theme variables
      default: 'bg-[var(--btn-default-bg)] hover:bg-[var(--btn-default-hover)] text-[var(--btn-default-text)] rounded-full border border-[var(--btn-default-border)] active:scale-[0.98]',
      // Secondary Ghost Pill using CSS theme variables
      ghost: 'bg-[var(--btn-default-bg)] hover:bg-[var(--btn-default-hover)] text-[var(--btn-default-text)] rounded-full border border-[var(--btn-default-border)] active:scale-[0.98]',
      // Outlined Pill using CSS theme variables
      outline: 'bg-[var(--btn-outline-bg)] hover:bg-[var(--btn-outline-hover-bg)] text-[var(--btn-outline-text)] hover:text-[var(--btn-outline-hover-text)] rounded-full border border-[var(--btn-outline-border)] active:scale-[0.98]',
      // Secondary Steel Plate fill
      secondary: 'bg-[#2f343e] hover:bg-[#3b414d] text-white rounded-full border border-[rgba(186,215,247,0.12)] active:scale-[0.98]',
      // Explicit Violet CTA: ONLY inside auth-forms, 6px radius
      violet: 'bg-[#18181b] hover:bg-[#09090b] text-white rounded-[6px] font-medium shadow-md shadow-[#18181b]/30 active:scale-[0.98]',
    };

    const sizes = {
      default: 'h-10 px-5 text-sm',
      sm: 'h-8 px-3.5 text-xs',
      lg: 'h-12 px-7 text-base',
      icon: 'h-10 w-10 p-0 rounded-full',
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
