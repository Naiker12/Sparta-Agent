"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"

interface ComboboxContextValue {
  open: boolean
  setOpen: (v: boolean) => void
  selectedValue: string
  onSelectedValueChange: (v: string) => void
  search: string
  setSearch: (v: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  triggerRef: React.RefObject<HTMLDivElement | null>
  items: readonly string[]
}

const ComboboxCtx = React.createContext<ComboboxContextValue | null>(null)

function useCombobox() {
  const ctx = React.useContext(ComboboxCtx)
  if (!ctx) throw new Error("Combobox sub-components must be used within <Combobox>")
  return ctx
}

interface ComboboxProps {
  items: readonly string[]
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

function Combobox({ items, value = "", onValueChange, children }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  React.useEffect(() => {
    if (open) {
      setSearch("")
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  return (
    <ComboboxCtx.Provider value={{ open, setOpen, selectedValue: value, onSelectedValueChange: onValueChange || (() => {}), search, setSearch, inputRef, containerRef, triggerRef, items }}>
      <div ref={containerRef} style={{ position: "relative" }}>
        {children}
      </div>
    </ComboboxCtx.Provider>
  )
}

const ComboboxInput = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
  function ComboboxInput({ className, placeholder, ...props }, ref) {
    const ctx = useCombobox()

    const setRef = React.useCallback(
      (el: HTMLInputElement | null) => {
        (ctx.inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el
        if (typeof ref === "function") ref(el)
      },
      [ref]
    )

    return (
      <div ref={ctx.triggerRef as React.RefObject<HTMLDivElement>} style={{ position: "relative" }}>
        <input
          ref={setRef}
          readOnly={!ctx.open}
          value={ctx.open ? ctx.search : ctx.selectedValue}
          onChange={(e) => { if (ctx.open) ctx.setSearch(e.target.value) }}
          onClick={() => ctx.setOpen(!ctx.open)}
          onKeyDown={(e) => {
            if (e.key === "Escape") ctx.setOpen(false)
            if (e.key === "Enter") { e.preventDefault(); ctx.setOpen(!ctx.open) }
          }}
          placeholder={ctx.open ? placeholder || "Buscar..." : ctx.selectedValue || placeholder || "Seleccionar..."}
          data-slot="combobox-input"
          className={cn(
            "flex h-9 w-full min-w-0 items-center rounded-lg border border-border bg-input px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-[var(--text-muted)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            ctx.open && "rounded-b-none",
            className
          )}
          {...props}
        />
        <button
          tabIndex={-1}
          onClick={() => ctx.setOpen(!ctx.open)}
          style={{
            position: "absolute", right: 8, top: "50%",
            transform: "translateY(-50%)",
            background: "none", border: "none",
            color: "var(--text-muted)", cursor: "pointer",
            display: "flex", alignItems: "center", padding: 0,
          }}
        >
          <ChevronDownIcon className="size-3.5" />
        </button>
      </div>
    )
  }
)

function ComboboxContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const ctx = useCombobox()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [visible, setVisible] = React.useState(false)
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 200 })

  React.useLayoutEffect(() => {
    if (!ctx.open) { setVisible(false); return }
    const trigger = ctx.triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const flip = spaceBelow < 200 && rect.top > 220
    setPosition({
      top: flip ? Math.max(4, rect.top - 4) : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
    setVisible(true)
  }, [ctx.open, ctx.triggerRef])

  if (!ctx.open) return null

  const filtered = ctx.search
    ? ctx.items.filter((item) => item.toLowerCase().includes(ctx.search.toLowerCase()))
    : ctx.items

  return (
    <div
      ref={contentRef}
      data-slot="combobox-content"
      className={cn("overflow-hidden rounded-lg border border-border-strong bg-popover shadow-xl", className)}
      style={{
        position: 'fixed',
        zIndex: 999999,
        top: position.top,
        left: position.left,
        width: position.width,
        visibility: visible ? 'visible' : 'hidden',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.1s ease',
      }}
    >
      {(() => {
        let listFn: ((item: string, index: number) => React.ReactNode) | null = null
        let emptyEl: React.ReactNode | null = null

        React.Children.forEach(children, (child) => {
          if (!React.isValidElement(child)) return
          const props = child.props as Record<string, unknown>
          if (typeof props.children === 'function') {
            listFn = props.children as (item: string, index: number) => React.ReactNode
          } else {
            emptyEl = child
          }
        })

        if (filtered.length === 0) {
          return emptyEl || <ComboboxEmpty />
        }

        if (!listFn) return emptyEl || null

        return (
          <div data-slot="combobox-list" className="max-h-60 overflow-y-auto p-1">
            {filtered.map((item, i) => listFn!(item, i))}
          </div>
        )
      })()}
    </div>
  )
}

function ComboboxEmpty({ children }: { children?: React.ReactNode }) {
  return (
    <div data-slot="combobox-empty" className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
      {children || "No se encontraron resultados"}
    </div>
  )
}
ComboboxEmpty.displayName = 'ComboboxEmpty'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ComboboxList(_props: { children: (item: string, index: number) => React.ReactNode }): null {
  return null
}
ComboboxList.displayName = 'ComboboxList'

interface ComboboxItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

function ComboboxItem({ value: itemValue, children, className }: ComboboxItemProps) {
  const ctx = useCombobox()

  return (
    <button
      type="button"
      onClick={() => {
        ctx.onSelectedValueChange(itemValue)
        ctx.setOpen(false)
      }}
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
        itemValue === ctx.selectedValue && "bg-[var(--accent-muted)] text-[var(--accent)]",
        className
      )}
    >
      <span className="flex-1 truncate text-left">{children}</span>
    </button>
  )
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
}
