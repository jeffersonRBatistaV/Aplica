import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'
import fs from 'fs'


const preloadSrc = path.resolve(__dirname, 'src/preload/preload.js')
const preloadOut = path.resolve(__dirname, 'dist-electron/preload.cjs')

function copyPreload() {
  if (!fs.existsSync(preloadSrc)) return
  fs.mkdirSync(path.dirname(preloadOut), { recursive: true })
  fs.copyFileSync(preloadSrc, preloadOut)
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/main.ts',
      vite: {
        build: {
          rollupOptions: {
            external: ['tesseract.js'],
          },
        },
      },
      },
    ]),
    {
      name: 'copy-preload',
      buildStart: copyPreload,
      configureServer(server) {
        server.watcher.add(preloadSrc)
        server.watcher.on('change', (file) => {
          if (file === preloadSrc) copyPreload()
        })
      },
    },
    renderer(),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
})
