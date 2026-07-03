export interface SpinnerSet {
  frames: string[]
  interval: number
}

export const SPINNERS: SpinnerSet[] = [
  { frames: ['\u25D4', '\u25D1', '\u25D5', '\u25D0'], interval: 120 }, // braille dots
  { frames: ['\u280B', '\u2819', '\u2839', '\u2830', '\u2820', '\u2826', '\u2827', '\u2807'], interval: 100 }, // braille 8-dot
  { frames: ['\u25DC', '\u25DD', '\u25DE', '\u25DF'], interval: 130 }, // half circles
  { frames: ['\u2B51', '\u2B52', '\u2B53', '\u2B54'], interval: 110 }, // black circles
  { frames: ['\u25D0', '\u25D3', '\u25D1', '\u25D2'], interval: 120 }, // fill spinners
  { frames: ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'], interval: 90 }, // vertical bars
  { frames: ['\u2596', '\u2597', '\u2598', '\u259D', '\u259E', '\u259F'], interval: 110 }, // quadrant blocks
]

const _spinnerIndex = Math.floor(Math.random() * SPINNERS.length)
export const DEFAULT_SPINNER = SPINNERS[_spinnerIndex]

export function getRandomSpinner(): SpinnerSet {
  return SPINNERS[Math.floor(Math.random() * SPINNERS.length)]
}
