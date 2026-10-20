import {useLayoutEffect, type RefObject} from "react";

/** Keep the native draggable overlay outside interactive sidebar chrome. */
export function useElectronDragBoundary(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useLayoutEffect(() => {
    if (!enabled || !ref.current) return;
    const region = document.querySelector<HTMLElement>('[data-slot="electron-window-drag-region"]');
    if (!region) return;
    const previous = region.style.left;
    const measure = () => {
      const box = ref.current?.getBoundingClientRect();
      region.style.left = `${box && box.width > 0 ? Math.max(48, Math.ceil(box.right) + 4) : 48}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(ref.current);
    window.addEventListener("resize", measure);
    return () => {observer.disconnect(); window.removeEventListener("resize", measure); region.style.left = previous;};
  }, [ref, enabled]);
}
