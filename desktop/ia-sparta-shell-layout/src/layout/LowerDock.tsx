import { motion } from 'framer-motion'
import { Bot, Cpu, Layers, Sparkles } from 'lucide-react'
import { useChatStore, useSessionStore, type Message, type ToolCall } from 'ia-sparta-core'

export function LowerDock() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const messagesBySession = useChatStore((s) => s.messagesBySession)

  const activeMessages: Message[] = activeSessionId
    ? (messagesBySession[activeSessionId] ?? [])
    : []

  const lastMessage: Message | undefined = activeMessages[activeMessages.length - 1]

  const isThinking = lastMessage?.thinkingStatus === 'streaming' || lastMessage?.isStreaming
  const toolCalls: ToolCall[] = lastMessage?.toolCalls ?? []
  const runningTools = toolCalls.filter((t: ToolCall) => t.status === 'running')
  const subagentParts = (lastMessage?.parts ?? []).filter((p) => p.kind === 'subagent')

  const totalTokens = activeMessages.reduce(
    (acc: number, m: Message) => acc + (m.thinkingTokensUsed ?? 0),
    0
  )

  if (!isThinking && runningTools.length === 0 && subagentParts.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed bottom-12 right-6 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-lg text-xs"
    >
      {/* Active Agents Chip */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent/10 text-accent font-medium text-[11px]">
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
          <span className="relative inline-flex rounded-full size-2 bg-accent"></span>
        </span>
        <Bot size={13} />
        <span>Sparta Agent Activo</span>
      </div>

      {/* Running Subagents or Tools */}
      {runningTools.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono text-[10.5px]">
          <Cpu size={12} className="animate-spin" />
          <span>{runningTools.length} Tool(s)</span>
        </div>
      )}

      {subagentParts.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono text-[10.5px]">
          <Layers size={12} />
          <span>{subagentParts.length} Subagente(s)</span>
        </div>
      )}

      {/* Token Context Usage */}
      {totalTokens > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-mono text-[10px]">
          <Sparkles size={11} className="text-accent" />
          <span>{totalTokens.toLocaleString()} tokens</span>
        </div>
      )}
    </motion.div>
  )
}
