import { describe, it, expect } from 'vitest'
import { getMessageRenderState } from '../message-render-state'

describe('getMessageRenderState', () => {
  it('thinking_pending: streaming, sin content, sin reasoning', () => {
    const state = getMessageRenderState('', undefined, true)
    expect(state.kind).toBe('thinking_pending')
  })

  it('thinking_live: streaming, sin content, con reasoning', () => {
    const state = getMessageRenderState('', 'I need to think...', true)
    expect(state.kind).toBe('thinking_live')
    if (state.kind === 'thinking_live') {
      expect(state.reasoningText).toBe('I need to think...')
    }
  })

  it('generating: streaming, con content, sin reasoning', () => {
    const state = getMessageRenderState('Hello', undefined, true)
    expect(state.kind).toBe('generating')
    if (state.kind === 'generating') {
      expect(state.content).toBe('Hello')
    }
  })

  it('responding: streaming, con content, con reasoning', () => {
    const state = getMessageRenderState('Hello', 'I need to think...', true)
    expect(state.kind).toBe('responding')
    if (state.kind === 'responding') {
      expect(state.content).toBe('Hello')
      expect(state.reasoningText).toBe('I need to think...')
    }
  })

  it('done: no streaming, con content, sin reasoning', () => {
    const state = getMessageRenderState('Hello', undefined, false)
    expect(state.kind).toBe('done')
    if (state.kind === 'done') {
      expect(state.content).toBe('Hello')
    }
  })

  it('done: no streaming, con content, con reasoning', () => {
    const state = getMessageRenderState('Hello', 'I thought', false)
    expect(state.kind).toBe('done')
    if (state.kind === 'done') {
      expect(state.content).toBe('Hello')
      expect(state.reasoningText).toBe('I thought')
    }
  })

  it('empty_error: no streaming, sin content ni reasoning', () => {
    const state = getMessageRenderState('', undefined, false)
    expect(state.kind).toBe('empty_error')
  })
})
