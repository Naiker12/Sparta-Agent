import { app, shell } from 'electron'
import path from 'node:path'

export const DESKTOP_APP_ID = 'com.sparta.agent'

export function configureDesktopIdentity(appRoot: string, assets: string): void {
  const existingUserData = app.getPath('userData')
  app.setName('Spartan')
  app.setPath('userData', existingUserData)
  if (process.platform !== 'win32') return
  app.setAppUserModelId(DESKTOP_APP_ID)
  // The installer owns the production shortcut. Development runs electron.exe,
  // so Windows needs a separate shortcut carrying Sparta's identity and icon.
  if (!app.isPackaged) {
    const shortcut = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Spartan (desarrollo).lnk')
    const registered = shell.writeShortcutLink(shortcut, 'create', {
      target: process.execPath,
      args: `"${appRoot}"`,
      cwd: appRoot,
      description: 'Spartan — desarrollo local',
      icon: path.join(assets, 'spartan.ico'),
      iconIndex: 0,
      appUserModelId: DESKTOP_APP_ID,
    })
    if (!registered) console.warn('[desktop] Could not register Sparta development shortcut')
  }
}
