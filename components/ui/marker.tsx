import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'ia-sparta-core'

const markerVariants = cva(
  'inline-flex items-center gap-2 text-xs transition-colors',
  {
    variants: {
      variant: {
        default: 'py-1 px-2.5 rounded-full border border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/50',
        border: 'w-full py-2 px-3 border-b border-border/50 text-muted-foreground justify-between',
        separator: 'w-full my-4 flex items-center justify-center gap-3 text-muted-foreground/70 before:h-px before:flex-1 before:bg-border/60 after:h-px after:flex-1 after:bg-border/60',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface MarkerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof markerVariants> {
  render?: React.ReactElement | ((props: any) => React.ReactElement)
}

export const Marker = React.forwardRef<HTMLDivElement, MarkerProps>(
  ({ className, variant, render, children, ...props }, ref) => {
    const combinedClassName = cn(markerVariants({ variant, className }))

    if (render) {
      if (React.isValidElement(render)) {
        return React.cloneElement(render, {
          ref,
          className: cn(combinedClassName, (render.props as any)?.className),
          ...props,
          children: children ?? (render.props as any)?.children,
        } as any)
      }
      if (typeof render === 'function') {
        return render({ ref, className: combinedClassName, children, ...props })
      }
    }

    return (
      <div ref={ref} className={combinedClassName} {...props}>
        {children}
      </div>
    )
  }
)
Marker.displayName = 'Marker'

export interface MarkerIconProps extends React.HTMLAttributes<HTMLSpanElement> {}

export const MarkerIcon = React.forwardRef<HTMLSpanElement, MarkerIconProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        aria-hidden="true"
        className={cn('inline-flex items-center justify-center shrink-0 text-muted-foreground', className)}
        {...props}
      >
        {children}
      </span>
    )
  }
)
MarkerIcon.displayName = 'MarkerIcon'

export interface MarkerContentProps extends React.HTMLAttributes<HTMLSpanElement> {
  shimmer?: boolean
}

export const MarkerContent = React.forwardRef<HTMLSpanElement, MarkerContentProps>(
  ({ className, shimmer, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'font-medium tracking-tight text-xs',
          shimmer && 'animate-pulse bg-gradient-to-r from-foreground via-muted-foreground to-foreground bg-clip-text text-transparent',
          className
        )}
        {...props}
      >
        {children}
      </span>
    )
  }
)
MarkerContent.displayName = 'MarkerContent'

export { markerVariants }
