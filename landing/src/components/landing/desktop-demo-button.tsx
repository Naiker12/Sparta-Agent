import type { ComponentProps } from 'react';
import { Button as DesktopButton } from '../../../../desktop/frontend-spartan/src/components/ui/button';
import { cn } from '@/lib/utils';

// Keep the desktop primitive while exposing landing's existing layout hooks.
export function Button({className,variant='default',size='default',type='button',...props}:ComponentProps<typeof DesktopButton>){
 return <DesktopButton type={type} variant={variant} size={size} className={cn('sparta-button', 'button-'+(variant==='default'?'primary':variant),'button-'+size,className)} {...props}/>;
}
