import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "../utils"

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full shadow-xs transition-colors duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-[var(--accent)] data-[state=unchecked]:bg-[var(--border-strong,rgba(120,120,128,0.25))] border border-[var(--border-subtle)]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
          "data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0.5",
          "data-[state=unchecked]:bg-white data-[state=unchecked]:shadow-xs"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
