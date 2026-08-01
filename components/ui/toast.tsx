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

export interface ToastOptions extends Omit<ToastManagerAddOptions<object>, "title" | "description"> {
  title?: React.ReactNode
  description?: React.ReactNode
  type?: "success" | "info" | "warning" | "error" | "loading" | string
  duration?: number
  actionProps?: React.ComponentPropsWithoutRef<"button">
}

function prepareOptions(options: ToastOptions): ToastManagerAddOptions<object> {
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

export function Toaster({ position = "top-right", ...props }: ToasterProps) {
  return (
    <Toast.Provider toastManager={toastManager} {...props}>
      <ToasterViewport position={position} />
    </Toast.Provider>
  )
}

function ToasterViewport({ position }: { position: string }) {
  const { toasts } = Toast.useToastManager()

  const positionClasses: Record<string, string> = {
    "top-left": "top-12 left-5 items-start",
    "top-center": "top-12 left-1/2 -translate-x-1/2 items-center",
    "top-right": "top-12 right-5 items-end",
    "bottom-left": "bottom-6 left-6 items-start",
    "bottom-center": "bottom-6 left-1/2 -translate-x-1/2 items-center",
    "bottom-right": "bottom-6 right-6 items-end",
  }

  return (
    <Toast.Portal>
      <Toast.Viewport
        className={cn(
          "fixed z-[99999] flex flex-col gap-2 max-w-[420px] w-auto p-2 pointer-events-none transition-all duration-200",
          positionClasses[position] || positionClasses["top-right"]
        )}
      >
        {toasts.map((t: any) => (
          <Toast.Root
            key={t.id}
            toast={t}
            className={cn(
              "pointer-events-auto flex items-center gap-3 w-auto max-w-[380px] border border-border text-popover-foreground transition-all duration-200 backdrop-blur-xl px-4 py-2.5 shadow-2xl group",
              "data-[starting]:opacity-0 data-[starting]:scale-95 data-[starting]:-translate-y-2",
              "data-[ending]:opacity-0 data-[ending]:scale-95 data-[ending]:-translate-y-1"
            )}
            style={{
              background: 'var(--bg-modal, var(--bg-surface, #1e1e22))',
              borderColor: 'var(--border-strong, var(--border-normal, rgba(255,255,255,0.18)))',
              borderRadius: 14,
              boxShadow: '0 14px 36px rgba(0,0,0,0.3)',
            }}
          >
            {/* Inline Icon - Vertically Centered */}
            {t.type === "success" && (
              <CheckCircle className="size-4 text-emerald-400 shrink-0 self-center" strokeWidth={1.8} />
            )}
            {t.type === "info" && (
              <Info className="size-4 text-sky-400 shrink-0 self-center" strokeWidth={1.8} />
            )}
            {t.type === "warning" && (
              <AlertTriangle className="size-4 text-amber-400 shrink-0 self-center" strokeWidth={1.8} />
            )}
            {t.type === "error" && (
              <XCircle className="size-4 text-rose-400 shrink-0 self-center" strokeWidth={1.8} />
            )}
            {t.type === "loading" && (
              <Loader2 className="size-4 text-sky-400 animate-spin shrink-0 self-center" strokeWidth={1.8} />
            )}
            {!t.type && (
              <Info className="size-4 text-sky-400 shrink-0 self-center" strokeWidth={1.8} />
            )}

            {/* Title & Description with comfortable spacing */}
            <div className="flex-1 min-w-0 overflow-hidden py-0.5">
              {t.title && (
                <Toast.Title
                  className="text-xs font-semibold tracking-tight leading-tight truncate m-0"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}
                >
                  {t.title}
                </Toast.Title>
              )}
              {t.description && (
                <Toast.Description
                  className="text-[11px] leading-snug truncate opacity-85 m-0 mt-0.5"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}
                >
                  {t.description}
                </Toast.Description>
              )}
            </div>

            {t.actionProps && (
              <Toast.Action
                {...t.actionProps}
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold h-6 px-2.5 transition-colors shrink-0 cursor-pointer shadow-xs self-center"
                style={{
                  background: 'var(--accent)',
                  color: '#ffffff',
                }}
              />
            )}

            {/* Close Button X - Vertically Centered */}
            <Toast.Close
              className="self-center flex items-center justify-center size-5 rounded-md transition-all focus:outline-none shrink-0 cursor-pointer opacity-60 hover:opacity-100 hover:bg-muted/60 ml-1"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="size-3.5" strokeWidth={1.8} />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
