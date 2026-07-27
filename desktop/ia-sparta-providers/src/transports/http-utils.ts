export const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: 'Solicitud inválida. Revisa los parámetros.',
  401: 'API key inválida o expirada.',
  403: 'Acceso denegado.',
  404: 'Endpoint no encontrado.',
  429: 'Rate limit del proveedor.',
  500: 'Error interno del servidor.',
  502: 'Error de gateway.',
  503: 'Servicio no disponible.',
  529: 'Proveedor sobrecargado.',
}

export function isRetryable(status: number): boolean {
  return status === 429 || status === 529
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 1,
  timeoutMs = 60_000,
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const signal = options.signal ?? AbortSignal.timeout(timeoutMs)
    try {
      const response = await fetch(url, { ...options, signal })
      if (!isRetryable(response.status) || i >= retries) return response
      const delay = Math.min(1000 * Math.pow(2, i), 8000)
      await new Promise((r) => setTimeout(r, delay))
      continue
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de red desconocido'
      if (signal.aborted || message === 'The operation was aborted.' || message === 'The operation was aborted due to timeout.') {
        throw new Error('La solicitud al proveedor tardó demasiado y se canceló. Revisa tu conexión o intenta de nuevo.')
      }
      if (i >= retries) {
        throw new Error(`Error de red al conectar con el proveedor: ${message}`)
      }
      const delay = Math.min(1000 * Math.pow(2, i), 8000)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('Error de red al conectar con el proveedor')
}
