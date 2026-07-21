import { useChatStore } from 'ia-sparta-core'

// RAF-throttled flush — accumulates tokens and flushes to the store at most
// once per animation frame (~16ms). Avoids re-render storms during fast
// streaming without adding latency.
//
// Each buffer is keyed by "sid:mid" so that tokens from multiple concurrent
// sessions are grouped independently without cross-contamination.

interface Buf { sid: string; mid: string; text: string }

const _writeBufs = new Map<string, Buf>()
const _thinkBufs = new Map<string, Buf>()
export let _flushRaf: number | null = null

function _bufKey(sid: string, mid: string): string {
  return `${sid}:${mid}`
}

export function _flushContent() {
  for (const [key, buf] of _writeBufs) {
    if (!buf.text) { _writeBufs.delete(key); continue }
    const text = buf.text
    buf.text = ''
    useChatStore.getState().appendContent(buf.sid, buf.mid, text)
  }
}

export function _flushThinking() {
  for (const [key, buf] of _thinkBufs) {
    if (!buf.text) { _thinkBufs.delete(key); continue }
    const text = buf.text
    buf.text = ''
    useChatStore.getState().appendThinking(buf.sid, buf.mid, text)
  }
}

export function _flushBoth() {
  _flushContent()
  _flushThinking()
}

function _scheduleFlush() {
  if (_flushRaf !== null) return
  _flushRaf = requestAnimationFrame(() => {
    _flushRaf = null
    _flushBoth()
  })
}

export function _cancelFlush() {
  if (_flushRaf !== null) { cancelAnimationFrame(_flushRaf); _flushRaf = null }
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
