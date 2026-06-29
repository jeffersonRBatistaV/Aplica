import { app, BrowserWindow, nativeTheme, Menu } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerAllHandlers } from './ipc'
import { ensureDir } from './services/storage'
import { DATA_DIR } from './utils/paths'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Aplica',
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
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
