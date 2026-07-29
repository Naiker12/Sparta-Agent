export const ELAPSED_VERBS = [
  'Cogitated',
  'Pondered',
  'Crunched',
  'Brewed',
  'Noodled',
  'Mulled',
  'Schemed',
  'Hatched',
  'Tinkered',
  'Conjured',
  'Distilled',
  'Wrangled',
  'Marinated',
  'Riffed',
  'Sleuthed',
  'Plotted',
  'Stewed',
  'Forged',
  'Spelunked',
  'Channeled',
]

export function pickElapsedVerb(seed: string): string {
  let hash = 5381
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash) % ELAPSED_VERBS.length
  return ELAPSED_VERBS[index] ?? 'Thought'
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0 || !Number.isFinite(seconds)) return '<1s'
  const rounded = Math.round(seconds)
  if (rounded < 60) return `${rounded}s`
  const mins = Math.floor(rounded / 60)
  const secs = rounded % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}
