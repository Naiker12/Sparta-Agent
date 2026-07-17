import { useEffect, useState } from 'react'
import { messagingAdapter } from 'ia-sparta-platform'
import type { SpartaEvent } from 'ia-sparta-core'

import { handleThinkingStarted, handleThinkingToken, handleThinkingCompleted, handleThinkingStatus, handleReasoningToken, handleReasoningAvailable } from './handlers/thinking.handler'
import { handleStreamToken, handleStreamCompleted, handleStreamAborted, handleStreamNotice, handleStreamError } from './handlers/stream.handler'
import { handleToolCalled, handleToolResult, handleToolError } from './handlers/tool.handler'
import { handleMCPEvent, handleMCPServerAdded, handleMCPServerRemoved } from './handlers/mcp.handler'
import { handleSearchProgress } from './handlers/search.handler'
import { handleSkillActivated, handleSkillCompleted } from './handlers/skill.handler'
import { handlePlanCreated, handlePlanStep, handleFileChanged, handleWorkspaceConnected, handleSidecarLog, handleTerminalAgentCommand, handleTerminalAgentSpawn } from './handlers/plan-etc.handler'
import type { EventHandlerCtx } from './handlers/types'

export type MapStore<K, V> = Map<K, V>

const _providerBySession = new Map<string, string>()
const _lastUserMessage = new Map<string, { text: string; userMessageId: string }>()

// ── Singleton listener ──────────────────────────────────────────────
let _singletonUnsub: (() => void) | null = null
let _refCount = 0

function _attachSingleton() {
  _refCount++
  if (_singletonUnsub) return
  _singletonUnsub = messagingAdapter.onEvent(_handleEvent)
  console.debug('[useStreamEvents] Singleton listener attached')
}

function _detachSingleton() {
  _refCount = Math.max(0, _refCount - 1)
  if (_refCount === 0 && _singletonUnsub) {
    _singletonUnsub()
    _singletonUnsub = null
    console.debug('[useStreamEvents] Singleton listener detached')
  }
}

// ── Central event handler (dispatcher) ──────────────────────────────
function _handleEvent(rawEvent: SpartaEvent) {
  const event = rawEvent as unknown as Record<string, unknown>
  const { type, sessionId, messageId } = event as { type: string; sessionId: string; messageId: string }
  const sid = sessionId ?? ''
  const mid = messageId ?? ''

  // ── Global events (no sessionId/messageId) ────────────────────────
  if (type === 'file:changed') {
    handleFileChanged({ event, sid, mid })
    return
  }
  if (type === 'plan:created') {
    handlePlanCreated({ event, sid, mid })
    return
  }
  if (type === 'plan:step') {
    handlePlanStep({ event, sid, mid })
    return
  }
  if (type === 'mcp:connected' || type === 'mcp:tool_discovered' || type === 'mcp:error') {
    handleMCPEvent(type, event)
    return
  }
  if (type === 'mcp:server_added') {
    handleMCPServerAdded({ event, sid, mid })
    return
  }
  if (type === 'mcp:server_removed') {
    handleMCPServerRemoved({ event, sid, mid })
    return
  }
  if (type === 'workspace:connected') {
    handleWorkspaceConnected({ event, sid, mid })
    return
  }
  if (type === 'sidecar:log') {
    handleSidecarLog({ event, sid, mid })
    return
  }
  if (type === 'terminal:agent_command') {
    handleTerminalAgentCommand({ event, sid, mid })
    return
  }
  if (type === 'terminal:agent_spawn') {
    handleTerminalAgentSpawn({ event, sid, mid })
    return
  }

  // ── Session-scoped events (require sessionId + messageId) ─────────
  if (!sid || !mid) {
    if (type && !type.startsWith('sidecar') && !type.startsWith('terminal') && !type.startsWith('mcp:')) {
      console.debug('[useStreamEvents] Event sin sessionId/messageId, ignorando:', type)
    }
    return
  }

  const ctx: EventHandlerCtx = { event, sid, mid }

  switch (type) {
    // Thinking / Reasoning
    case 'thinking:started': handleThinkingStarted(ctx); break
    case 'thinking:token': handleThinkingToken(ctx); break
    case 'thinking:completed': handleThinkingCompleted(ctx); break
    case 'thinking:status': handleThinkingStatus(ctx); break
    case 'reasoning:token': handleReasoningToken(ctx); break
    case 'reasoning:available': handleReasoningAvailable(ctx); break

    // Stream lifecycle
    case 'stream:token': handleStreamToken(ctx); break
    case 'stream:completed': handleStreamCompleted(ctx, _providerBySession, _lastUserMessage); break
    case 'stream:aborted': handleStreamAborted(ctx, _providerBySession, _lastUserMessage); break
    case 'stream:notice': handleStreamNotice(ctx); break
    case 'stream:error': handleStreamError(ctx, _providerBySession, _lastUserMessage); break

    // Tool calls
    case 'tool:called': handleToolCalled(ctx); break
    case 'tool:result': handleToolResult(ctx); break
    case 'tool:error': handleToolError(ctx); break

    // Search
    case 'search:progress': handleSearchProgress(ctx); break

    // Skills
    case 'skill:activated': handleSkillActivated(ctx); break
    case 'skill:completed': handleSkillCompleted(ctx); break
  }
}

// ── Hook público ────────────────────────────────────────────────────
export function useStreamEvents() {
  const [adapterReady, setAdapterReady] = useState(messagingAdapter.isReady())

  useEffect(() => {
    if (adapterReady) return
    return messagingAdapter.onReady?.(() => setAdapterReady(true)) ?? (() => {})
  }, [adapterReady])

  useEffect(() => {
    if (!adapterReady) return
    _attachSingleton()
    return () => { _detachSingleton() }
  }, [adapterReady])

  return {
    adapterReady,
    setProviderForSession: (sessionId: string, providerId: string) => {
      _providerBySession.set(sessionId, providerId)
    },
    setLastUserMessage: (sessionId: string, text: string, userMessageId: string) => {
      _lastUserMessage.set(sessionId, { text, userMessageId })
    },
  }
}
