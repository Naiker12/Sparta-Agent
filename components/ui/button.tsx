import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:opacity-90 font-medium",
        destructive:
          "bg-destructive text-white shadow-xs hover:opacity-90 font-medium",
        outline:
          "border border-border bg-input shadow-xs text-foreground hover:bg-hover",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs border border-border-subtle hover:bg-hover",
        ghost:
          "text-muted-foreground hover:bg-hover hover:text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3.5 py-1.5 text-xs font-medium shrink-0",
        xs: "h-6.5 px-3 py-1 text-xs rounded-md font-medium shrink-0",
        sm: "h-7.5 rounded-md px-3.5 py-1 text-xs font-medium shrink-0",
        lg: "h-9 rounded-md px-4 text-sm font-medium shrink-0",
        icon: "size-8 rounded-md shrink-0",
        "icon-xs": "size-6 rounded-md shrink-0",
        "icon-sm": "size-7 rounded-md shrink-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants>
>(({ className, variant, size, ...props }, ref) => {
  return (
    <ButtonPrimitive
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
