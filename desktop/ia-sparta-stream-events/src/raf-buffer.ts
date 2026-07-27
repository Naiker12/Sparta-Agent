import { useChatStore } from 'ia-sparta-core'

// Throttled flush — accumulates tokens and flushes to the store at most
// once per `MIN_FLUSH_MS` to avoid re-render storms during fast streaming.
// We still try to align with the next animation frame when possible, but
// avoid flushing every RAF which can be too frequent for heavy reasoning.
//
// Each buffer is keyed by "sid:mid" so that tokens from multiple concurrent
// sessions are grouped independently without cross-contamination.

interface Buf { sid: string; mid: string; text: string }

const _writeBufs = new Map<string, Buf>()
const _thinkBufs = new Map<string, Buf>()
let _flushTimer: number | null = null
let _usingRaf = false
let _lastFlushAt = 0
const MIN_FLUSH_MS = 50 // minimum ms between flushes

const PROFILE = typeof globalThis !== 'undefined' && !!(globalThis as any).__SPARTA_PROFILE_STREAMS__
let _flushCount = 0
let _totalCharsFlushed = 0

function _logProfile(msg: string) {
  if (!PROFILE) return
  // eslint-disable-next-line no-console
  console.debug('[raf-buffer.profile]', msg)
}

function _bufKey(sid: string, mid: string): string {
  return `${sid}:${mid}`
}

export function _flushContent() {
  for (const [key, buf] of _writeBufs) {
    if (!buf.text) { _writeBufs.delete(key); continue }
    const text = buf.text
    buf.text = ''
    _flushCount++
    _totalCharsFlushed += text.length
    const t0 = PROFILE && typeof performance !== 'undefined' ? performance.now() : 0
    useChatStore.getState().appendContent(buf.sid, buf.mid, text)
    const t1 = PROFILE && typeof performance !== 'undefined' ? performance.now() : 0
    if (PROFILE) _logProfile(`flushContent sid=${buf.sid} mid=${buf.mid} chars=${text.length} time=${(t1-t0).toFixed(2)}ms totalFlushes=${_flushCount} totalChars=${_totalCharsFlushed}`)
  }
}

export function _flushThinking() {
  for (const [key, buf] of _thinkBufs) {
    if (!buf.text) { _thinkBufs.delete(key); continue }
    const text = buf.text
    buf.text = ''
    _flushCount++
    _totalCharsFlushed += text.length
    const t0 = PROFILE && typeof performance !== 'undefined' ? performance.now() : 0
    useChatStore.getState().appendThinking(buf.sid, buf.mid, text)
    const t1 = PROFILE && typeof performance !== 'undefined' ? performance.now() : 0
    if (PROFILE) _logProfile(`flushThinking sid=${buf.sid} mid=${buf.mid} chars=${text.length} time=${(t1-t0).toFixed(2)}ms totalFlushes=${_flushCount} totalChars=${_totalCharsFlushed}`)
  }
}

export function _flushBoth() {
  _flushContent()
  _flushThinking()
  _lastFlushAt = Date.now()
  if (PROFILE) _logProfile(`flushBoth totalFlushes=${_flushCount} totalChars=${_totalCharsFlushed}`)
}

function _scheduleFlush() {
  if (_flushTimer !== null) return
  const now = Date.now()
  const since = now - _lastFlushAt
  const remaining = Math.max(0, MIN_FLUSH_MS - since)
  // Prefer to run on next RAF when the remaining time is very small
  if (remaining <= 8 && typeof globalThis.requestAnimationFrame === 'function') {
    _usingRaf = true
    _flushTimer = globalThis.requestAnimationFrame(() => {
      _usingRaf = false
      _flushTimer = null
      _flushBoth()
    }) as unknown as number
    return
  }

  _usingRaf = false
  _flushTimer = (globalThis.setTimeout as typeof setTimeout)(() => {
    _flushTimer = null
    _flushBoth()
  }, remaining) as unknown as number
}

export function _cancelFlush() {
  if (_flushTimer !== null) {
    if (_usingRaf && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(_flushTimer)
    } else {
      clearTimeout(_flushTimer)
    }
    _flushTimer = null
    _usingRaf = false
  }
}

export function queueContent(sid: string, mid: string, token: string) {
  const key = _bufKey(sid, mid)
  let buf = _writeBufs.get(key)
  if (!buf) {
    buf = { sid, mid, text: '' }
    _writeBufs.set(key, buf)
  }
  buf.text += token
  _scheduleFlush()
}

export function queueThinking(sid: string, mid: string, token: string) {
  const key = _bufKey(sid, mid)
  let buf = _thinkBufs.get(key)
  if (!buf) {
    buf = { sid, mid, text: '' }
    _thinkBufs.set(key, buf)
  }
  buf.text += token
  _scheduleFlush()
}
