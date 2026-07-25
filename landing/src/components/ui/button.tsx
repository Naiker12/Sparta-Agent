import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'violet';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#663af3] disabled:pointer-events-none disabled:opacity-50 cursor-pointer';

    const variants = {
      // Primary CTA: Void Violet #663af3 solid fill
      default: 'bg-[#663af3] hover:bg-[#5b31e0] text-white rounded-full font-medium shadow-lg shadow-[#663af3]/25 active:scale-[0.98]',
      // Secondary Ghost Pill: faint frost wash rgba(186,214,247,0.06), 1px inset border rgba(186,215,247,0.12)
      ghost: 'bg-[rgba(186,214,247,0.06)] hover:bg-[rgba(186,214,247,0.12)] text-white rounded-full border border-[rgba(186,215,247,0.12)] active:scale-[0.98]',
      // Outlined Pill: transparent fill, text #d1e4fa, 1px inset border rgba(186,215,247,0.12)
      outline: 'bg-transparent hover:bg-[rgba(186,214,247,0.08)] text-[#d1e4fa] hover:text-white rounded-full border border-[rgba(186,215,247,0.12)] active:scale-[0.98]',
      // Secondary Steel Plate fill
      secondary: 'bg-[#2f343e] hover:bg-[#3b414d] text-white rounded-full border border-[rgba(186,215,247,0.12)] active:scale-[0.98]',
      // Explicit Violet CTA
      violet: 'bg-[#663af3] hover:bg-[#5b31e0] text-white rounded-full font-medium shadow-md shadow-[#663af3]/30 active:scale-[0.98]',
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
