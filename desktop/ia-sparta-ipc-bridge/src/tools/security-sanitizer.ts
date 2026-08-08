/**
 * security-sanitizer.ts
 * Lógica pura de sanitización de comandos sin dependencias nativas de node-pty.
 */

export const DESTRUCTIVE_PATTERNS = [
  /^rm\s+(-rf?\s+)?(\/|[~]\/|\.\.)/,
  /^rmdir\s+\//,
  /^dd\s+if=/,
  /^mkfs\./,
  /^fdisk\s+/,
  /^format\s+/,
  /^mkswap\b/,
  /gpg\s+--symmetric\s+--passphrase/,
  /openssl\s+enc\s+-aes-256-cbc/,
  /find\s+\/.*-exec\s+rm/,
  />\s*(\/etc\/|\/boot\/|\/sys\/)/,
  />\s*([a-zA-Z]:\\Windows\\|[a-zA-Z]:\\System32\\)/i,
  /chmod\s+-R\s+777\s+\//,
  /chown\s+-R\s+.*\s+\//,
  /curl\s+.*\|\s*(bash|sh|zsh)/,
  /wget\s+.*\|\s*(bash|sh|zsh)/,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // Fork bomb
  />\s*(sparta-vault\.json|\.env|id_rsa|id_ed25519)/,
  /\bformat\s+\/[qQ]/,
  /\bdiskpart\b/,
]

export class CommandSanitizer {
  private static readonly DESTRUCTIVE_PATTERNS = DESTRUCTIVE_PATTERNS

  public static isForbidden(command: string): boolean {
    const trimmed = command.trim()
    return CommandSanitizer.DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(trimmed))
  }
}
