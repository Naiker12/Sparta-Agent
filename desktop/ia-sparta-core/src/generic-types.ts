/**
 * ia-sparta-core — Tipos genéricos transversales
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type BrandedId<T extends string> = string & { __brand: T }