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
      <ToasterViewport position={position} closeButton={props.closeButton ?? true} />
    </Toast.Provider>
  )
}

type ToastVisual = {
  Icon: typeof Info
  color: string
  tint: string
}

const toastVisuals: Record<string, ToastVisual> = {
  success: { Icon: CheckCircle, color: 'var(--status-ok)', tint: 'color-mix(in srgb, var(--status-ok) 12%, transparent)' },
  info: { Icon: Info, color: 'var(--accent)', tint: 'var(--accent-muted)' },
  warning: { Icon: AlertTriangle, color: 'var(--status-warn)', tint: 'color-mix(in srgb, var(--status-warn) 12%, transparent)' },
  error: { Icon: XCircle, color: 'var(--status-err)', tint: 'color-mix(in srgb, var(--status-err) 12%, transparent)' },
  loading: { Icon: Loader2, color: 'var(--accent)', tint: 'var(--accent-muted)' },
}

function ToasterViewport({ position, closeButton }: { position: string; closeButton: boolean }) {
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
        {toasts.map((t: any) => {
          const visual = toastVisuals[t.type] ?? toastVisuals.info
          const Icon = visual.Icon
          return (
            <Toast.Root
            key={t.id}
            toast={t}
            className={cn(
              "pointer-events-auto flex items-start gap-3 w-full max-w-[360px] border text-popover-foreground transition-all duration-200 backdrop-blur-xl px-3 py-2.5 shadow-xl group",
              "data-[starting]:opacity-0 data-[starting]:scale-[0.98] data-[starting]:-translate-y-1",
              "data-[ending]:opacity-0 data-[ending]:scale-[0.98] data-[ending]:-translate-y-1"
            )}
            style={{
              background: 'color-mix(in srgb, var(--bg-modal, var(--bg-surface, #1e1e22)) 92%, transparent)',
              borderColor: 'var(--border-strong, var(--border-normal, rgba(255,255,255,0.18)))',
              borderLeftWidth: 3,
              borderLeftColor: visual.color,
              borderRadius: 12,
              boxShadow: '0 12px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, borderRadius: 7, background: visual.tint, color: visual.color }}>
              <Icon size={14} strokeWidth={1.9} className={t.type === 'loading' ? 'animate-spin' : undefined} />
            </div>

            <div className="flex-1 min-w-0 py-0.5">
              {t.title && (
                <Toast.Title
                className="text-[12.5px] font-semibold tracking-[-0.01em] leading-[1.35] m-0"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}
                >
                  {t.title}
                </Toast.Title>
              )}
              {t.description && (
                <Toast.Description
                className="text-[11.5px] leading-[1.45] m-0 mt-0.5"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}
                >
                  {t.description}
                </Toast.Description>
              )}
            </div>

            {t.actionProps && (
              <Toast.Action
                {...t.actionProps}
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold h-7 px-2.5 transition-colors shrink-0 cursor-pointer self-center"
                style={{
                  background: 'var(--accent)',
                  color: '#ffffff',
                }}
              />
            )}

            {closeButton && (
              <Toast.Close
                className="flex items-center justify-center size-6 rounded-md transition-all focus:outline-none shrink-0 cursor-pointer opacity-60 group-hover:opacity-100 focus:opacity-100"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Cerrar notificación"
              >
                <X size={14} strokeWidth={1.8} />
              </Toast.Close>
            )}
            </Toast.Root>
          )
        })}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
