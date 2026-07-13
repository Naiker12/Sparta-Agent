import { toast } from 'sonner'

/**
 * Toast con id fijo por categoría — reemplaza en vez de apilar.
 * Evita duplicados cuando el usuario dispara la misma acción dos veces seguidas.
 */
export function toastReplace(
  kind: 'success' | 'info' | 'error' | 'warning',
  category: string,
  title: string,
  opts?: Parameters<typeof toast.info>[1],
) {
  toast[kind](title, { ...opts, id: `sparta-${category}` })
}
