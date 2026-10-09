import { createContext, type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";

export const PreviewToolbarTarget = createContext<HTMLElement | null>(null);

/** Each viewer contributes controls to the panel's single shared toolbar. */
export function PreviewToolbar({ children }: { children: ReactNode }) {
  const target = useContext(PreviewToolbarTarget);
  return target ? createPortal(children, target) : (
    <div className="flex shrink-0 items-center justify-end gap-1 px-3 py-1.5">{children}</div>
  );
}
