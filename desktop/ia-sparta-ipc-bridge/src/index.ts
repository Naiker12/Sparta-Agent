/**
 * ia-sparta-ipc-bridge — IPC bridge
 *
 * Fachada pública.
 *
 * NOTE: `preload.ts` is NOT re-exported here.  It is built as a separate
 * entry by vite-plugin-electron and runs in the renderer sandbox.  Including
 * it in the barrel would pull `contextBridge`/`ipcRenderer` into the main
 * process bundle, causing "does not provide an export" errors at load time.
 */
export * from './channels/chat.ipc.ts'
export * from './channels/file-watcher.ts'
export * from './channels/filesystem.channel.ts'
export * from './channels/keymanager.ipc.ts'
export * from './channels/memory.ipc.ts'
export * from './channels/models.channel.ts'
export * from './channels/permission.channel.ts'
export * from './channels/security.ipc.ts'
export * from './channels/sidecar.channel.ts'
export * from './channels/skills.channel.ts'
export * from './channels/terminal.channel.ts'
export * from './channels/vault.ipc.ts'
export * from './channels/document.channel'
export * from './channels/system.channel'
export * from './channels/harness-detect.channel'
export * from './tools/main-process-file-tools'
export * from './tools/main-process-shell-tool'

import { registerChatIPC } from './channels/chat.ipc.ts'
import { registerFilesystemIPC } from './channels/filesystem.channel.ts'
import { registerKeyManagerIPC } from './channels/keymanager.ipc.ts'
import { registerMemoryIPC } from './channels/memory.ipc.ts'
import { registerModelsIPC } from './channels/models.channel.ts'
import { registerPermissionIPC } from './channels/permission.channel.ts'
import { registerSecurityIPC } from './channels/security.ipc.ts'
import { registerSidecarIPC } from './channels/sidecar.channel.ts'
import { registerSkillsIPC } from './channels/skills.channel.ts'
import { registerTerminalIPC } from './channels/terminal.channel.ts'
import { registerVaultIPC } from './channels/vault.ipc.ts'
import { registerDocumentIPC } from './channels/document.channel'
import { registerSystemIPC } from './channels/system.channel'
import { registerHarnessDetectIPC } from './channels/harness-detect.channel'

export function registerAllIPC() {
  registerFilesystemIPC()
  registerTerminalIPC()
  registerVaultIPC()
  registerSkillsIPC()
  registerModelsIPC()
  registerPermissionIPC()
  registerSecurityIPC()
  registerSidecarIPC()
  registerKeyManagerIPC()
  registerMemoryIPC()
  registerHarnessDetectIPC()
  registerChatIPC()
  registerDocumentIPC()
  registerSystemIPC()
}

