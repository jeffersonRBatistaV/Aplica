import { useState, useEffect, useCallback } from 'react'
import { Download, RotateCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  total: number
  transferred: number
}

export default function UpdateBanner() {
  const { t } = useTranslation()
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const unsubAvailable = window.api.onUpdateAvailable((info) => {
      setUpdateInfo(info)
      setDismissed(false)
    })
    const unsubProgress = window.api.onUpdateProgress((p) => {
      setProgress(p)
      setDownloading(true)
    })
    const unsubDownloaded = window.api.onUpdateDownloaded(() => {
      setDownloaded(true)
      setDownloading(false)
    })
    return () => {
      unsubAvailable()
      unsubProgress()
      unsubDownloaded()
    }
  }, [])

  const handleDownload = useCallback(() => {
    window.api.startUpdateDownload()
  }, [])

  const handleInstall = useCallback(() => {
    window.api.quitAndInstall()
  }, [])

  if (dismissed || !updateInfo) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-zinc-500 hover:text-zinc-300"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          {downloaded ? (
            <RotateCw className="w-4 h-4 text-blue-400" />
          ) : (
            <Download className="w-4 h-4 text-blue-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100">
            {downloaded
              ? 'Actualizacion lista'
              : `Aplica v${updateInfo.version} disponible`}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {downloaded
              ? 'Reinicia para instalar la actualizacion'
              : downloading
                ? 'Descargando...'
                : 'Una nueva version esta disponible'}
          </p>

          {progress && (
            <div className="mt-2">
              <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {Math.round(progress.percent)}%
              </p>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {!downloading && !downloaded && (
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Descargar
              </button>
            )}
            {downloaded && (
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
              >
                Reiniciar y actualizar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
