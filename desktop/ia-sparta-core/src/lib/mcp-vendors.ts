/** Catalog vendor lookup used across packages that don't depend on ia-sparta-mcp. */
const SERVER_VENDORS: Record<string, string> = {
  github: 'github',
  git: 'git',
  filesystem: 'filesystem',
  'google-drive': 'google',
  onedrive: 'microsoft',
  supabase: 'supabase',
  dbhub: 'database',
  mongodb: 'mongodb',
  notion: 'notion',
  gmail: 'google',
  'google-calendar': 'google',
  slack: 'slack',
  figma: 'figma',
  stripe: 'stripe',
  sentry: 'sentry',
  fetch: 'fetch',
  playwright: 'playwright',
  'chrome-devtools': 'chrome',
  memory: 'memory',
  time: 'time',
}

export function getVendorForServer(serverId: string): string | undefined {
  return SERVER_VENDORS[serverId]
}
