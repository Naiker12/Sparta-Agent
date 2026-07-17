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
