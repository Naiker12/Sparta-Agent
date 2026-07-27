import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import type { ToastManagerAddOptions, ToastManagerPromiseOptions } from "@base-ui/react/toast"
import { CheckCircle, Info, AlertTriangle, XCircle, Loader2, X } from "lucide-react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const toastManager = Toast.createToastManager()

export interface ToastOptions extends Omit<ToastManagerAddOptions<any>, "title" | "description"> {
  title?: React.ReactNode
  description?: React.ReactNode
  type?: "success" | "info" | "warning" | "error" | "loading" | string
  duration?: number
  actionProps?: React.ComponentPropsWithoutRef<"button">
}

function prepareOptions(options: ToastOptions): ToastManagerAddOptions<any> {
  const { duration, timeout, ...rest } = options
  return {
    ...rest,
    timeout: timeout ?? duration ?? 3500,
  }
}

export const toast = Object.assign(
  (options: ToastOptions | string) => {
    if (typeof options === "string") {
      return toastManager.add({ title: options })
    }
    return toastManager.add(prepareOptions(options))
  },
  {
    add: (options: ToastOptions | string) => {
      if (typeof options === "string") {
        return toastManager.add({ title: options })
      }
      return toastManager.add(prepareOptions(options))
    },
    close: (id?: string) => toastManager.close(id),
    update: (id: string, options: Partial<ToastOptions>) => toastManager.update(id, options),
    promise: <T,>(
      promise: Promise<T>,
      options: ToastManagerPromiseOptions<T, any>
    ) => toastManager.promise(promise, options),
    success: (title: React.ReactNode, options?: Omit<ToastOptions, "title" | "type">) =>
      toastManager.add(prepareOptions({ ...options, title, type: "success" })),
    info: (title: React.ReactNode, options?: Omit<ToastOptions, "title" | "type">) =>
      toastManager.add(prepareOptions({ ...options, title, type: "info" })),
    warning: (title: React.ReactNode, options?: Omit<ToastOptions, "title" | "type">) =>
      toastManager.add(prepareOptions({ ...options, title, type: "warning" })),
    error: (title: React.ReactNode, options?: Omit<ToastOptions, "title" | "type">) =>
      toastManager.add(prepareOptions({ ...options, title, type: "error" })),
    loading: (title: React.ReactNode, options?: Omit<ToastOptions, "title" | "type">) =>
      toastManager.add(prepareOptions({ ...options, title, type: "loading" })),
  }
)

export interface ToasterProps extends React.ComponentPropsWithoutRef<typeof Toast.Provider> {
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"
  richColors?: boolean
  closeButton?: boolean
}

export function Toaster({ position = "bottom-right", ...props }: ToasterProps) {
  return (
    <Toast.Provider toastManager={toastManager} {...props}>
      <ToasterViewport position={position} />
    </Toast.Provider>
  )
}

function ToasterViewport({ position }: { position: string }) {
  const { toasts } = Toast.useToastManager()

  const positionClasses: Record<string, string> = {
    "top-left": "top-5 left-5 items-start",
    "top-center": "top-5 left-1/2 -translate-x-1/2 items-center",
    "top-right": "top-5 right-5 items-end",
    "bottom-left": "bottom-6 left-6 items-start",
    "bottom-center": "bottom-6 left-1/2 -translate-x-1/2 items-center",
    "bottom-right": "bottom-6 right-6 items-end",
  }

  return (
    <Toast.Portal>
      <Toast.Viewport
        className={cn(
          "fixed z-[99999] flex flex-col gap-2 max-w-[360px] w-full p-2 pointer-events-none transition-all duration-200",
          positionClasses[position] || positionClasses["bottom-right"]
        )}
      >
        {toasts.map((t: any) => (
          <Toast.Root
            key={t.id}
            toast={t}
            className={cn(
              "pointer-events-auto flex items-center gap-3 w-full border text-popover-foreground transition-all duration-200 backdrop-blur-xl px-3.5 py-3 shadow-2xl group",
              "data-[starting]:opacity-0 data-[starting]:scale-95 data-[starting]:translate-y-2",
              "data-[ending]:opacity-0 data-[ending]:scale-95 data-[ending]:translate-y-1"
            )}
            style={{
              background: 'var(--bg-modal, #141919)',
              borderColor: 'var(--border-strong, rgba(255,255,255,0.12))',
              borderRadius: 'var(--radius-lg, 10px)',
              boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
            }}
          >
            {/* Built-in Status Icons (Traycer Styled) */}
            {t.type === "success" && (
              <CheckCircle className="size-4 text-emerald-500 shrink-0" />
            )}
            {t.type === "info" && (
              <Info className="size-4 text-teal-400 shrink-0" />
            )}
            {t.type === "warning" && (
              <AlertTriangle className="size-4 text-amber-500 shrink-0" />
            )}
            {t.type === "error" && (
              <XCircle className="size-4 text-rose-500 shrink-0" />
            )}
            {t.type === "loading" && (
              <Loader2 className="size-4 text-teal-400 animate-spin shrink-0" />
            )}

            <div className="flex-1 min-w-0 overflow-hidden">
              {t.title && (
                <Toast.Title
                  className="text-xs font-semibold tracking-tight leading-snug truncate"
                  style={{ color: 'var(--text-primary, #f3f4f6)', fontFamily: 'var(--font-ui)' }}
                >
                  {t.title}
                </Toast.Title>
              )}
              {t.description && (
                <Toast.Description
                  className="text-[11px] leading-normal truncate opacity-80"
                  style={{ color: 'var(--text-secondary, #9ca3af)', fontFamily: 'var(--font-mono)' }}
                >
                  {t.description}
                </Toast.Description>
              )}
            </div>

            {t.actionProps && (
              <Toast.Action
                {...t.actionProps}
                className="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2.5 transition-colors shrink-0 cursor-pointer shadow-xs"
                style={{
                  background: 'var(--accent)',
                  color: '#ffffff',
                }}
              />
            )}

            <Toast.Close
              className="rounded-md p-1 transition-all focus:outline-none shrink-0 cursor-pointer opacity-60 hover:opacity-100"
              style={{ color: 'var(--text-muted, #9ca3af)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <X className="size-3.5" />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
