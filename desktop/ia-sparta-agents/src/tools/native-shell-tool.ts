/**
 * native-shell-tool.ts — Herramienta nativa `run_command` para el agente.
 *
 * Envuelve window.terminal.agentSpawn (que ya existe y está huérfano) para
 * ejecutar comandos shell en segundo plano con streaming de output y exit code.
 * Emite eventos al EventBus para que RunningCommandBlock los consuma en la UI.
 */

import { useFolderStore } from 'ia-sparta-core'
import type { NativeToolDefinition } from './native-file-tools'

export const NATIVE_SHELL_TOOL_NAME = 'run_command' as const

export function getNativeShellToolDefinition(): NativeToolDefinition {
  return {
    name: 'run_command',
    description:
      'Ejecuta un comando en la terminal del sistema (shell) en segundo plano. ' +
      'El comando se ejecuta en el directorio de trabajo de la carpeta conectada. ' +
      'Devuelve la salida completa del comando y su código de salida. ' +
      'Usa este tool para instalar dependencias, compilar, ejecutar scripts, listar archivos, etc.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'El comando a ejecutar en la terminal (ej: "npm install", "git status", "ls -la").',
        },
        cwd: {
          type: 'string',
          description: 'Directorio de trabajo opcional. Si no se proporciona, usa la carpeta conectada.',
        },
      },
      required: ['command'],
    },
  }
}

export function isNativeShellTool(name: string): boolean {
  return name === NATIVE_SHELL_TOOL_NAME
}

export async function executeNativeShellTool(
  args: Record<string, unknown>,
): Promise<string> {
  if (typeof window === 'undefined' || !window.terminal?.agentSpawn) {
    throw new Error('run_command requiere Electron (window.terminal.agentSpawn no disponible).')
  }

  const command = String(args.command ?? '').trim()
  if (!command) throw new Error('run_command requiere "command".')

  const cwd = args.cwd ? String(args.cwd) : useFolderStore.getState().connectedPath || undefined
  const procId = `agent-cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return new Promise<string>((resolve, reject) => {
    const outputChunks: string[] = []
    let settled = false

    // Listen for output chunks
    const unsubOutput = window.terminal.onAgentOutput((payload) => {
      if (payload.procId !== procId) return
      outputChunks.push(payload.chunk)
    })

    // Listen for process exit
    const unsubExit = window.terminal.onAgentExit((payload) => {
      if (payload.procId !== procId) return
      settled = true
      unsubOutput()
      unsubExit()

      const fullOutput = outputChunks.join('')
      // Strip ANSI escape sequences for cleaner output to the LLM
      const cleanOutput = fullOutput.replace(
        // eslint-disable-next-line no-control-regex
        /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
        '',
      )

      if (payload.code === 0) {
        resolve(
          `Comando completado exitosamente (exit code: 0)\n\n` +
            `$ ${command}\n` +
            `${cleanOutput.trim() || '(sin salida)'}`,
        )
      } else {
        resolve(
          `Comando finalizado con exit code: ${payload.code}\n\n` +
            `$ ${command}\n` +
            `${cleanOutput.trim() || '(sin salida)'}`,
        )
      }
    })

    // Spawn the process
    window.terminal
      .agentSpawn(procId, command, cwd)
      .then((result) => {
        if (!result.success) {
          settled = true
          unsubOutput()
          unsubExit()
          reject(new Error(result.error ?? 'Error al ejecutar el comando.'))
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true
          unsubOutput()
          unsubExit()
          reject(err)
        }
      })

    // Safety timeout: 5 minutes max per command
    setTimeout(() => {
      if (!settled) {
        settled = true
        unsubOutput()
        unsubExit()
        // Try to kill the process
        window.terminal.agentKill(procId).catch(() => {})
        const partialOutput = outputChunks.join('').replace(
          // eslint-disable-next-line no-control-regex
          /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
          '',
        )
        resolve(
          `Comando cancelado por timeout (5 minutos)\n\n` +
            `$ ${command}\n` +
            `${partialOutput.trim() || '(sin salida)'}`,
        )
      }
    }, 5 * 60 * 1000)
  })
}
