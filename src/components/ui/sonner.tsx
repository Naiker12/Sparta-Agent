import { useSyncExternalStore } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircle, Info, AlertTriangle, XOctagon, Loader2 } from "lucide-react"

function getThemeMode(): "dark" | "light" {
  if (typeof document === "undefined") return "dark"
  const mode = document.documentElement.getAttribute("data-theme-mode")
  if (mode === "light" || mode === "dark") return mode
  return "dark"
}

function useThemeMode() {
  return useSyncExternalStore(
    (cb) => {
      const observer = new MutationObserver(cb)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode"] })
      return () => observer.disconnect()
    },
    getThemeMode,
    getThemeMode
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useThemeMode()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <CheckCircle className="size-4" />
        ),
        info: (
          <Info className="size-4" />
        ),
        warning: (
          <AlertTriangle className="size-4" />
        ),
        error: (
          <XOctagon className="size-4" />
        ),
        loading: (
          <Loader2 className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
