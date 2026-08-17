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
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 520 ||
    status === 521 ||
    status === 522 ||
    status === 524 ||
    status === 529
  )
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  timeoutMs = 120_000,
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
      const isTimeoutErr = signal.aborted || /aborted/i.test(message) || /timeout/i.test(message)
      if (isTimeoutErr) {
        throw new Error('La conexión al proveedor tardó demasiado tiempo y se canceló por tiempo de espera (timeout). Por favor reintenta o verifica tu red.')
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
