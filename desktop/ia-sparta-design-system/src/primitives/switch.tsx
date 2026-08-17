import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "../utils"

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full shadow-xs transition-colors duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-[var(--accent)] data-[state=unchecked]:bg-[var(--bg-active)] border border-[var(--border-subtle)]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
          "data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-0.5"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
