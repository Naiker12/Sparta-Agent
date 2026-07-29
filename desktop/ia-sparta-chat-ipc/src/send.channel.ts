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
import { ChatCompletionsTransport, AnthropicTransport, OllamaTransport } from 'ia-sparta-providers'
import { loadSkillDocuments, isMainProcessFileTool, executeMainProcessFileTool, runCommandForAgent } from 'ia-sparta-ipc-bridge'
import { buildWebSearchTool, executeWebSearch, buildWebFetchTool, executeWebFetch } from 'ia-sparta-core'

const MAX_SKILL_CONTEXT_CHARS = 16_000
const MAX_SKILL_DOCUMENTS_PER_TURN = 4

function getSearchTerms(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9_-]{3,}/g) ?? [])]
}

function buildSkillContext(activeSkillIds: string[] | undefined, userText: string): string {
  if (!activeSkillIds?.length) return ''

  const activeIds = new Set(activeSkillIds)
  const skills = loadSkillDocuments().filter((skill) => activeIds.has(skill.id))
  if (skills.length === 0) return ''

  const manifest = skills
    .map((skill) => `- ${skill.id} | ${skill.category} | ${skill.name}: ${skill.description.slice(0, 180)}`)
    .join('\n')
  const terms = getSearchTerms(userText)
  const relevant = skills
    .map((skill) => {
      const haystack = `${skill.id} ${skill.name} ${skill.description} ${skill.tags.join(' ')} ${skill.category}`.toLowerCase()
      return { skill, score: terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0) }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .slice(0, MAX_SKILL_DOCUMENTS_PER_TURN)

  let remaining = Math.max(0, MAX_SKILL_CONTEXT_CHARS - manifest.length)
  const documents = relevant.flatMap(({ skill }) => {
    if (remaining <= 0) return []
    const body = skill.body.slice(0, remaining)
    remaining -= body.length
    return [`\n## Skill: ${skill.name} (${skill.id})\n${body}`]
  })

  return [
    '## Skills disponibles',
    'Estas habilidades estan activas. Usa las instrucciones detalladas solo cuando sean relevantes para la solicitud actual.',
    manifest,
    ...documents,
  ].join('\n')
}

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

    // Try to get provider key from vault with vendor & provider ID fallbacks
    const vendor = req.vendor || req.providerId || 'openai'
    const providerId = req.providerId || ''
    const apiKey =
      req.providerKey ||
      (providerId ? vaultGetKey(providerId) : null) ||
      vaultGetKey(`api_key_${vendor}`) ||
      vaultGetKey(vendor) ||
      vaultGetKey('api_key_openai') ||
      vaultGetKey('openai') ||
      process.env.OPENAI_API_KEY ||
      ''

    const isLocalProvider = req.isLocal || vendor === 'ollama' || vendor === 'lmstudio' || vendor === 'llamacpp'

    if (apiKey || isLocalProvider || req.apiUrl) {
      try {
        const effectiveKey = apiKey || (isLocalProvider ? 'local' : '')
        const transport =
          vendor === 'anthropic'
            ? new AnthropicTransport(effectiveKey)
            : vendor === 'ollama'
            ? new OllamaTransport(req.apiUrl || 'http://localhost:11434')
            : new ChatCompletionsTransport(vendor as any, effectiveKey, req.apiUrl)
        const userText = [...(req.messages || [])].reverse().find((message) => message.role === 'user')?.content ?? ''
        const skillContext = buildSkillContext(req.skills, userText)
        const folderPath = req.connectedFolder || req.workspaceRoot
        const workspaceContext = folderPath
          ? `[INFORMACIÓN DEL WORKSPACE]\nLa carpeta de trabajo conectada es: "${folderPath}".\nUsá esta ruta absoluta como base para list_directory, read_file, write_file, edit_file, delete_file y run_command a menos que el usuario indique explícitamente otra.`
          : ''

        const systemPrompt = [
          req.system || 'Sos Sparta Agent, un asistente de ingeniería de software de alto rendimiento.',
          workspaceContext,
          skillContext,
        ].filter(Boolean).join('\n\n')

        const formattedMessages = (req.messages || []).map(m => ({ role: m.role as any, content: m.content }))

        // Prepare tools list and inject web_search + web_fetch tools if webSearchEnabled is true
        const tools: unknown[] = req.tools ? [...req.tools] : []
        if (req.webSearchEnabled) {
          const hasWebSearch = tools.some((t: any) =>
            t.name === 'web_search' || t.function?.name === 'web_search'
          )
          if (!hasWebSearch) {
            tools.push(buildWebSearchTool())
          }
          const hasWebFetch = tools.some((t: any) =>
            t.name === 'web_fetch' || t.function?.name === 'web_fetch'
          )
          if (!hasWebFetch) {
            tools.push(buildWebFetchTool())
          }
        }

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
          let pendingToolCall: { id: string; toolName: string; input: Record<string, unknown> } | null = null

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
              pendingToolCall = {
                id: chunk.toolCall.id || `call_${Date.now()}`,
                toolName: chunk.toolCall.toolName || 'web_search',
                input: (chunk.toolCall.input as Record<string, unknown>) || {},
              }
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

          if (streamFailed || streamAborted) {
            break
          }

          // If no tool call was requested by the model, execution is complete
          if (!pendingToolCall) {
            completeThinking()
            sendToRenderer({
              sessionId,
              messageId,
              type: 'stream:completed',
            })
            break
          }

          // Handle tool call execution
          const toolCallId = pendingToolCall.id
          const toolName = pendingToolCall.toolName
          const toolInput = pendingToolCall.input

          // 1. Notify renderer that a tool was called
          sendToRenderer({
            sessionId,
            messageId,
            type: 'tool:called',
            toolCallId,
            toolName,
            name: toolName,
            input: toolInput,
          })

          let toolOutput = ''

          if (toolName === 'web_search') {
            const query = typeof toolInput.query === 'string' ? toolInput.query : JSON.stringify(toolInput)

            // 2. Emit search:progress event for searching stage
            sendToRenderer({
              sessionId,
              messageId,
              type: 'search:progress',
              stage: 'searching',
              query,
              tool_call_id: toolCallId,
            })

            sendToRenderer({
              sessionId,
              messageId,
              type: 'thinking:status',
              text: `Buscando en la web: "${query}"...`,
            })

            // 3. Execute real search
            toolOutput = await executeWebSearch(query)

            // 4. Emit search:progress event for done stage
            sendToRenderer({
              sessionId,
              messageId,
              type: 'search:progress',
              stage: 'done',
              tool_call_id: toolCallId,
            })
          } else if (toolName === 'web_fetch') {
            const url = typeof toolInput.url === 'string' ? toolInput.url.trim() : ''

            sendToRenderer({
              sessionId,
              messageId,
              type: 'thinking:status',
              text: url ? `Obteniendo ${url}...` : 'Obteniendo página web...',
            })

            sendToRenderer({
              sessionId,
              messageId,
              type: 'search:progress',
              stage: 'searching',
              query: url,
              tool_call_id: toolCallId,
            })

            toolOutput = await executeWebFetch(url)

            sendToRenderer({
              sessionId,
              messageId,
              type: 'search:progress',
              stage: 'done',
              tool_call_id: toolCallId,
            })
          } else if (isMainProcessFileTool(toolName)) {
            sendToRenderer({
              sessionId,
              messageId,
              type: 'thinking:status',
              text: `Ejecutando ${toolName}...`,
            })
            try {
              toolOutput = await executeMainProcessFileTool(
                toolName,
                toolInput as Record<string, unknown>,
                req.connectedFolder || req.workspaceRoot,
              )
            } catch (err) {
              toolOutput = `Error ejecutando ${toolName}: ${err instanceof Error ? err.message : String(err)}`
            }
          } else if (toolName === 'run_command') {
            const command = typeof toolInput.command === 'string' ? toolInput.command : JSON.stringify(toolInput)
            sendToRenderer({
              sessionId,
              messageId,
              type: 'thinking:status',
              text: `Ejecutando comando: ${command}...`,
            })
            try {
              const res = await runCommandForAgent(
                toolCallId,
                command,
                (toolInput.cwd as string) || req.connectedFolder || req.workspaceRoot,
              )
              toolOutput = res.output
            } catch (err) {
              toolOutput = `Error ejecutando comando: ${err instanceof Error ? err.message : String(err)}`
            }
          } else {
            toolOutput = `Herramienta ${toolName} ejecutada.`
          }

          // 5. Notify renderer of tool output
          sendToRenderer({
            sessionId,
            messageId,
            type: 'tool:result',
            toolCallId,
            toolName,
            output: toolOutput,
          })

          // 6. Update formattedMessages to append assistant tool_call & tool response for next turn
          formattedMessages.push({
            role: 'assistant' as any,
            content: turnContent || null,
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

          formattedMessages.push({
            role: 'tool' as any,
            tool_call_id: toolCallId,
            content: toolOutput,
          } as any)

          sendToRenderer({
            sessionId,
            messageId,
            type: 'thinking:status',
            text: 'Sintetizando respuesta con datos obtenidos...',
          })
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
