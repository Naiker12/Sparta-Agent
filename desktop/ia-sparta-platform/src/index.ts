/**
 * ia-sparta-platform — Adaptadores de plataforma (Electron vs Web)
 *
 * Fachada pública. Exporta los adaptadores que permiten que el código
 * funcione en ambas plataformas sin duplicar lógica.
 */
export * from './env'
export * from './messaging/messaging-adapter'
export * from './vault/vault-adapter'
export * from './vault/web-vault'
export * from './terminal/terminal-ws-driver'