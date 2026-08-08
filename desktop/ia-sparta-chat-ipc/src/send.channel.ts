/**
 * send.channel.ts
 * Canal IPC principal para enviar mensajes al modelo de IA.
 * Delega la lógica a módulos especializados en send/.
 */

import { ipcMain, BrowserWindow } from 'electron'
import {
  type ChatRequest,
  activeStreams,
  windowBySession,
  streamResolvers,
  lastActivity,
  sendToRenderer,
} from './shared'
import { getKey as vaultGetKey } from 'ia-sparta-vault'
import { ChatCompletionsTransport, AnthropicTransport, OllamaTransport } from '../../ia-sparta-providers/src/transports'
import { buildSystemPrompt } from './send/system-prompt'
import { buildToolsList } from './send/tool-injector'
import { executeToolCall } from './send/tool-executor'

export function registerChatSendIPC(): void {
  ipcMain.handle('chat:send', async (_event, req: ChatRequest) => {
    const { sessionId, messageId } = req
    const requestId = `${sessionId}:${messageId}`

    activeStreams.set(sessionId, { active: true, messageId })

    const win = BrowserWindow.fromWebContents(_event.sender)
    if (win && !win.isDestroyed()) {
      windowBySession.set(sessionId, win)
    }

    lastActivity.set(sessionId, Date.now())

    // Emit thinking started & completion events natively
    sendToRenderer({
      sessionId,
      messageId,
      type: 'thinking:started',
      origin: 'native',
    })
    let thinkingCompleted = false
    const completeThinking = () => {
      if (thinkingCompleted) return
      thinkingCompleted = true
      const activeStream = activeStreams.get(sessionId)
      if (activeStream) {
        activeStreams.set(sessionId, { ...activeStream, thinkingCompleted: true })
      }
      sendToRenderer({ sessionId, messageId, type: 'thinking:completed' })
    }

    // Resolve keys only within the selected provider.  Falling back to OpenAI
    // here can send a Gemini (or another vendor) key to api.openai.com.
    const vendor = req.vendor || req.providerId || 'openai'
    const providerId = req.providerId || ''
    const apiKey =
      req.providerKey ||
      (providerId ? vaultGetKey(providerId) : null) ||
      vaultGetKey(`api_key_${vendor}`) ||
      vaultGetKey(vendor) ||
      process.env[`${vendor.toUpperCase()}_API_KEY`] ||
      ''

    const isLocalProvider = req.isLocal || vendor === 'ollama' || vendor === 'lmstudio' || vendor === 'llamacpp'

    if (apiKey || isLocalProvider || req.apiUrl) {
      try {
        const effectiveKey = apiKey || ''
        const transport =
          vendor === 'anthropic'
            ? new AnthropicTransport(effectiveKey)
            : vendor === 'ollama'
            ? new OllamaTransport(req.apiUrl || 'http://localhost:11434')
            : new ChatCompletionsTransport(vendor as any, effectiveKey, req.apiUrl)

        const userText = [...(req.messages || [])].reverse().find((message) => message.role === 'user')?.content ?? ''
        const systemPrompt = buildSystemPrompt(req, userText)
        const formattedMessages = (req.messages || []).map(m => ({ role: m.role as any, content: m.content }))
        const tools = buildToolsList(req.tools, req.webSearchEnabled, req.mode as 'chat' | 'agent')

        sendToRenderer({
          sessionId,
          messageId,
          type: 'thinking:status',
          text: 'Conectando con el modelo...',
        })

        let loopCount = 0
        const MAX_LOOPS = 5
        let streamFailed = false
        let streamAborted = false

        while (loopCount < MAX_LOOPS) {
          loopCount++
          let turnContent = ''
          const pendingToolCalls: Array<{ id: string; toolName: string; input: Record<string, unknown> }> = []

          for await (const chunk of transport.streamChat({
            model: req.model,
            messages: formattedMessages,
            system: systemPrompt,
            tools: tools.length > 0 ? tools : undefined,
            thinkingEnabled: req.reasoning?.enabled,
            thinkingBudget: req.reasoning?.budget,
            reasoningEffort: req.reasoning?.effort as 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | undefined,
          })) {
            const activeState = activeStreams.get(sessionId)
            if (!activeState?.active) {
              streamAborted = true
              break
            }

            if (chunk.type === 'content_token' && chunk.delta) {
              completeThinking()
              turnContent += chunk.delta
              sendToRenderer({
                sessionId,
                messageId,
                type: 'stream:token',
                token: chunk.delta,
              })
            } else if (chunk.type === 'thinking_token' && chunk.delta) {
              sendToRenderer({
                sessionId,
                messageId,
                type: 'thinking:token',
                token: chunk.delta,
              })
            } else if (chunk.type === 'tool_call' && chunk.toolCall) {
              pendingToolCalls.push({
                id: chunk.toolCall.id || `call_${Date.now()}_${pendingToolCalls.length}`,
                toolName: chunk.toolCall.toolName || 'web_search',
                input: (chunk.toolCall.input as Record<string, unknown>) || {},
              })
            } else if (chunk.type === 'error' && chunk.error) {
              streamFailed = true
              completeThinking()
              sendToRenderer({
                sessionId,
                messageId,
                type: 'stream:error',
                error: chunk.error,
              })
              break
            }
          }

          if (streamAborted || streamFailed) break

          // If assistant gave text content, append it to messages history
          if (turnContent) {
            formattedMessages.push({ role: 'assistant', content: turnContent } as any)
          }

          if (pendingToolCalls.length > 0) {
            completeThinking()

            for (const toolCall of pendingToolCalls) {
              const { id: toolCallId, toolName, input: toolInput } = toolCall

              sendToRenderer({
                sessionId,
                messageId,
                type: 'tool:called',
                toolCallId,
                toolName,
                name: toolName,
                input: toolInput,
              })

              const toolOutput = await executeToolCall({
                sessionId,
                messageId,
                toolCallId,
                toolName,
                toolInput,
                mcpServers: req.mcpServers,
                connectedFolder: req.connectedFolder,
                workspaceRoot: req.workspaceRoot,
              })

              sendToRenderer({
                sessionId,
                messageId,
                type: 'tool:result',
                toolCallId,
                toolName,
                output: toolOutput,
              })

              // Append assistant tool_call message if not already present
              const lastMsg = formattedMessages[formattedMessages.length - 1] as any
              if (!lastMsg || lastMsg.role !== 'assistant') {
                formattedMessages.push({
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    {
                      id: toolCallId,
                      type: 'function',
                      function: {
                        name: toolName,
                        arguments: JSON.stringify(toolInput),
                      },
                    },
                  ],
                } as any)
              } else {
                if (!lastMsg.tool_calls) lastMsg.tool_calls = []
                lastMsg.tool_calls.push({
                  id: toolCallId,
                  type: 'function',
                  function: {
                    name: toolName,
                    arguments: JSON.stringify(toolInput),
                  },
                })
              }

              formattedMessages.push({
                role: 'tool',
                tool_call_id: toolCallId,
                content: typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput),
              } as any)
            }

            // Continue loop to get assistant's response to tool output
            sendToRenderer({
              sessionId,
              messageId,
              type: 'thinking:status',
              text: 'Sintetizando respuesta con datos obtenidos...',
            })
            continue
          }

          sendToRenderer({
            sessionId,
            messageId,
            type: 'stream:completed',
          })
          break
        }
      } catch (err) {
        completeThinking()
        sendToRenderer({
          sessionId,
          messageId,
          type: 'stream:error',
          error: (err as Error).message || 'Error en la llamada al modelo',
        })
      }
    } else {
      // Direct native fallback when no API key is configured yet
      sendToRenderer({
        sessionId,
        messageId,
        type: 'thinking:completed',
      })
      sendToRenderer({
        sessionId,
        messageId,
        type: 'stream:token',
        token: `¡Hola! Soy **Sparta Agent**. Para recibir respuestas en tiempo real de modelos de IA, configura tu clave API (OpenAI, Anthropic, Gemini, Groq u Ollama) en el panel de **Ajustes** ⚙️.`,
      })
      sendToRenderer({
        sessionId,
        messageId,
        type: 'stream:completed',
      })
    }

    activeStreams.delete(sessionId)
    lastActivity.delete(sessionId)
    const resolveStream = streamResolvers.get(requestId)
    if (resolveStream) {
      resolveStream()
      streamResolvers.delete(requestId)
    }

    return { ok: true }
  })

  ipcMain.handle('chat:abort', (_event, sessionId: string) => {
    const state = activeStreams.get(sessionId)
    if (state) {
      activeStreams.set(sessionId, { ...state, active: false })
      if (!state.thinkingCompleted) {
        sendToRenderer({
          sessionId,
          messageId: state.messageId,
          type: 'thinking:completed',
        })
      }
      sendToRenderer({
        sessionId,
        messageId: state.messageId,
        type: 'stream:aborted',
      })
      activeStreams.delete(sessionId)
    }
  })
}
