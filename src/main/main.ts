import { app, BrowserWindow, nativeTheme, Menu, Notification } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerAllHandlers } from './ipc'
import { ensureDir, readJSON } from './services/storage'
import { DATA_DIR, JOBS_FILE } from './utils/paths'
import { initUpdater } from './services/updater'
import type { JobApplication } from '../shared/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getIconPath(): string {
  if (app.isPackaged) {
    return path.join(__dirname, '../../resources/icon.ico')
  }
  return path.join(process.cwd(), 'resources/icon.ico')
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Aplica',
    icon: getIconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// Forward system theme changes to renderer
nativeTheme.on('updated', () => {
  mainWindow?.webContents.send('system:themeChanged', nativeTheme.shouldUseDarkColors)
})

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  await ensureDir(DATA_DIR)
  createWindow()

  if (mainWindow) {
    registerAllHandlers(mainWindow)
    initUpdater(mainWindow)
  }

  setTimeout(checkUpcomingInterviews, 5000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

async function checkUpcomingInterviews(): Promise<void> {
  if (!Notification.isSupported()) return
  try {
    const jobs = (await readJSON<JobApplication[]>(JOBS_FILE)) ?? []
    const now = Date.now()
    const windowMs = 24 * 3600 * 1000
    const upcoming = jobs.filter(
      (j) => j.status === 'interview' && j.interviewDate && j.interviewDate > now && j.interviewDate - now < windowMs,
    )
    if (upcoming.length === 0) return
    const next = upcoming.sort((a, b) => (a.interviewDate as number) - (b.interviewDate as number))[0]
    const date = new Date(next.interviewDate as number)
    new Notification({
      title: 'Aplica — Entrevista próxima',
      body: `${next.position} en ${next.company} — ${date.toLocaleString()}`,
    }).show()
  } catch (e) {
    console.error('[checkUpcomingInterviews]', e)
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
