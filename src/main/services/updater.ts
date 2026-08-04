import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null
let checkTimer: NodeJS.Timeout | null = null
let lastCheck = 0

const CHECK_INTERVAL_MS = 30 * 60 * 1000
const FOCUS_THROTTLE_MS = 10 * 60 * 1000

export function initUpdater(win: BrowserWindow): void {
  mainWindow = win

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', info)
  })
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:progress', progress)
  })
  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:downloaded')
  })
  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message)
  })

  const check = () => {
    const now = Date.now()
    if (now - lastCheck < FOCUS_THROTTLE_MS) return
    lastCheck = now
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] check failed', err.message)
    })
  }

  check()
  checkTimer = setInterval(check, CHECK_INTERVAL_MS)
  win.on('focus', check)
}

export async function startUpdateDownload(): Promise<void> {
  await autoUpdater.downloadUpdate()
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}

export function stopUpdater(): void {
  if (checkTimer) clearInterval(checkTimer)
  autoUpdater.removeAllListeners()
}
