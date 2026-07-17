import { useChatStore } from 'ia-sparta-core'

// RAF-throttled flush — accumulates tokens and flushes to the store at most
// once per animation frame (~16ms). Avoids re-render storms during fast
// streaming without adding latency.

interface Buf { sid: string; mid: string; text: string }

export const _writeBuf: Buf = { sid: '', mid: '', text: '' }
export const _thinkBuf: Buf = { sid: '', mid: '', text: '' }
export let _flushRaf: number | null = null

export function _flushContent() {
  const { sid, mid, text } = _writeBuf
  if (!text) return
  _writeBuf.text = ''
  useChatStore.getState().appendContent(sid, mid, text)
}

export function _flushThinking() {
  const { sid, mid, text } = _thinkBuf
  if (!text) return
  _thinkBuf.text = ''
  useChatStore.getState().appendThinking(sid, mid, text)
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
  if (_writeBuf.sid !== sid || _writeBuf.mid !== mid) {
    _flushContent()
    _writeBuf.sid = sid
    _writeBuf.mid = mid
  }
  _writeBuf.text += token
  _scheduleFlush()
}

export function queueThinking(sid: string, mid: string, token: string) {
  if (_thinkBuf.sid !== sid || _thinkBuf.mid !== mid) {
    _flushThinking()
    _thinkBuf.sid = sid
    _thinkBuf.mid = mid
  }
  _thinkBuf.text += token
  _scheduleFlush()
}
