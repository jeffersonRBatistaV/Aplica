import { app, BrowserWindow, nativeTheme, Menu, Notification, session, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerAllHandlers } from './ipc'
import { ensureDir, readJSON } from './services/storage'
import { DATA_DIR } from './utils/paths'
import { migrateProfileScopedData, migrateLegacyEmailConfig, getActiveProfileFiles } from './services/profile-data'
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

// Evita dos instancias de Aplica peleando por el mismo perfil de WhatsApp
// (Chromium no permite dos procesos con el mismo userDataDir).
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

const BROWSER_PARTITION = 'persist:aplica-browser'

function isSafeGuestUrl(url: string): boolean {
  if (!url || url === 'about:blank') return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function setupBrowserSecurity(): void {
  const browserSession = session.fromPartition(BROWSER_PARTITION)
  browserSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  browserSession.setPermissionCheckHandler(() => false)
  const userAgent = browserSession
    .getUserAgent()
    .replace(/\sElectron\/[\d.]+/g, '')
    .replace(/\sAplica\/[\d.]+/g, '')
    .trim()
  browserSession.setUserAgent(userAgent)

  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      if (!isSafeGuestUrl(url)) event.preventDefault()
    })
  })
}

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
      webviewTag: true,
    },
  })

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    webPreferences.webSecurity = true
    webPreferences.allowRunningInsecureContent = false
    webPreferences.partition = BROWSER_PARTITION
    if (!isSafeGuestUrl(params.src || '')) event.preventDefault()
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
  if (!gotTheLock) return
  Menu.setApplicationMenu(null)
  await ensureDir(DATA_DIR)
  await migrateProfileScopedData()
  await migrateLegacyEmailConfig()
  setupBrowserSecurity()
  createWindow()

  if (mainWindow) {
    registerAllHandlers(mainWindow)
    initUpdater(mainWindow)
  }

  setTimeout(checkUpcomingInterviews, 5000)
  setTimeout(checkPendingFollowUps, 15000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

async function checkUpcomingInterviews(): Promise<void> {
  if (!Notification.isSupported()) return
  try {
    const jobsFile = (await getActiveProfileFiles()).jobsFile
    const jobs = (await readJSON<JobApplication[]>(jobsFile)) ?? []
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

const FOLLOW_UP_AFTER_DAYS = 7
const DAY_MS = 24 * 3600 * 1000

/**
 * Recordatorio amable al abrir la app: postulaciones sin respuesta desde hace una semana.
 * Al pulsar la notificación se trae la ventana al frente (Inicio muestra los seguimientos).
 */
async function checkPendingFollowUps(): Promise<void> {
  if (!Notification.isSupported()) return
  try {
    const jobsFile = (await getActiveProfileFiles()).jobsFile
    const jobs = (await readJSON<JobApplication[]>(jobsFile)) ?? []
    const now = Date.now()
    const base = (j: JobApplication) => j.lastFollowUpAt ?? j.appliedAt ?? j.updatedAt ?? j.createdAt
    const pending = jobs
      .filter((j) => j.status === 'applied' && now - base(j) >= FOLLOW_UP_AFTER_DAYS * DAY_MS)
      .sort((a, b) => base(a) - base(b))
    if (pending.length === 0) return
    const first = pending[0]
    const days = Math.floor((now - base(first)) / DAY_MS)
    const company = first.company || 'una empresa'
    const body = pending.length === 1
      ? `Hace ${days} días enviaste tu CV a ${company}. ¿Le escribimos un mensaje de seguimiento?`
      : `Hace ${days} días enviaste tu CV a ${company} y tienes ${pending.length - 1} postulación(es) más sin respuesta. Un seguimiento puede marcar la diferencia.`
    const notification = new Notification({ title: 'Aplica — Es buen momento para dar seguimiento', body })
    notification.on('click', () => {
      if (!mainWindow) return
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    })
    notification.show()
  } catch (e) {
    console.error('[checkPendingFollowUps]', e)
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
