/**
 * ia-sparta-core — Misceláneas
 */
export function noop(): void {
  /* no-op */
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}