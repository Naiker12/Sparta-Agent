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
  bgTint: string
}

const toastVisuals: Record<string, ToastVisual> = {
  success: { Icon: CheckCircle, color: '#10b981', bgTint: 'color-mix(in srgb, #10b981 12%, transparent)' },
  info: { Icon: Info, color: 'var(--accent)', bgTint: 'var(--accent-muted)' },
  warning: { Icon: AlertTriangle, color: '#f59e0b', bgTint: 'color-mix(in srgb, #f59e0b 12%, transparent)' },
  error: { Icon: XCircle, color: '#ef4444', bgTint: 'color-mix(in srgb, #ef4444 12%, transparent)' },
  loading: { Icon: Loader2, color: 'var(--accent)', bgTint: 'var(--accent-muted)' },
}

function ToasterViewport({ position, closeButton }: { position: string; closeButton: boolean }) {
  const { toasts } = Toast.useToastManager()

  const positionClasses: Record<string, string> = {
    "top-left": "top-10 left-5 items-start",
    "top-center": "top-10 left-1/2 -translate-x-1/2 items-center",
    "top-right": "top-10 right-5 items-end",
    "bottom-left": "bottom-6 left-6 items-start",
    "bottom-center": "bottom-6 left-1/2 -translate-x-1/2 items-center",
    "bottom-right": "bottom-6 right-6 items-end",
  }

  return (
    <Toast.Portal>
      <Toast.Viewport
        className={cn(
          "fixed z-[999999] flex flex-col gap-2 max-w-[400px] w-auto p-2 pointer-events-none transition-all duration-200",
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
                "pointer-events-auto flex items-center gap-3 w-auto min-w-[220px] max-w-[360px] transition-all duration-200 backdrop-blur-2xl group",
                "data-[starting]:opacity-0 data-[starting]:scale-[0.95] data-[starting]:-translate-y-2",
                "data-[ending]:opacity-0 data-[ending]:scale-[0.95] data-[ending]:-translate-y-2"
              )}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-normal)',
                borderRadius: 999,
                padding: '6px 14px 6px 8px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06)',
              }}
            >
              {/* Circular Status Icon Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: visual.bgTint,
                  color: visual.color,
                }}
              >
                <Icon size={13} strokeWidth={2} className={t.type === 'loading' ? 'animate-spin' : undefined} />
              </div>

              {/* Title & Description Text */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                {t.title && (
                  <Toast.Title
                    className="text-[12px] font-semibold leading-tight m-0 truncate"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}
                  >
                    {t.title}
                  </Toast.Title>
                )}
                {t.description && (
                  <Toast.Description
                    className="text-[11px] leading-tight m-0 mt-0.5 truncate"
                    style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}
                  >
                    {t.description}
                  </Toast.Description>
                )}
              </div>

              {t.actionProps && (
                <Toast.Action
                  {...t.actionProps}
                  className="inline-flex items-center justify-center rounded-full text-[11px] font-semibold h-6 px-2.5 transition-colors shrink-0 cursor-pointer self-center"
                  style={{
                    background: 'var(--accent)',
                    color: '#ffffff',
                  }}
                />
              )}

              {closeButton && (
                <Toast.Close
                  className="flex items-center justify-center size-5 rounded-full transition-all focus:outline-none shrink-0 cursor-pointer opacity-50 hover:opacity-100 focus:opacity-100"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Cerrar notificación"
                >
                  <X size={12} strokeWidth={2} />
                </Toast.Close>
              )}
            </Toast.Root>
          )
        })}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
