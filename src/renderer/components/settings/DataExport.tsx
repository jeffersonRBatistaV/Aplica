import { useState, useRef } from 'react'
import { FileJson, FileSpreadsheet, Loader2, Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useNotification } from '../../contexts/NotificationContext'
import { useTranslation } from 'react-i18next'

export function DataExport() {
  const { t } = useTranslation()
  const { notify } = useNotification()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState<'json' | 'xlsx' | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ filePath: string; conversations: number; jobs: number; profile: boolean; settings: boolean; cvTemplates: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)

  const handleExport = async (format: 'json' | 'xlsx') => {
    setExporting(format)
    try {
      const data = await window.api.exportAll()
      const path = await window.api.saveExportFile(data, format)
      if (path) {
        notify(t('dataExport.exported', { file: path.split('/').pop() }), 'success')
      }
    } catch (e) {
      notify(t('dataExport.exportError'), 'error')
      console.error(e)
    } finally {
      setExporting(null)
    }
  }

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)
    setImportError(null)
    setCancelled(false)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let content: string

      if (ext === 'json') {
        content = await file.text()
      } else if (ext === 'xlsx') {
        const buffer = await file.arrayBuffer()
        const uint8 = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i])
        }
        content = btoa(binary)
      } else {
        setImportError(t('dataExport.unsupportedFormat'))
        return
      }

      const result = await window.api.processImportData(file.name, content)
      if (!result) {
        setCancelled(true)
      } else if (!result.ok) {
        setImportError(result.error)
        notify(result.error, 'error')
      } else {
        const { stats, filePath } = result
        const parts: string[] = []
        if (stats.profile) parts.push(t('dataExport.profile'))
        if (stats.jobs > 0) parts.push(`${stats.jobs} ${t('dataExport.applications')}`)
        if (stats.conversations > 0) parts.push(`${stats.conversations} ${t('dataExport.conversations')}`)
        if (stats.cvTemplates > 0) parts.push(`${stats.cvTemplates} ${t('dataExport.cvTemplates')}`)
        if (stats.settings) parts.push(t('dataExport.config'))

        const detail = parts.length > 0 ? `${t('dataExport.imported')}: ${parts.join(', ')}` : t('dataExport.noNewData')
        notify(detail, 'success')

        setImportResult({
          filePath: result.filePath,
          ...stats,
        })

        window.dispatchEvent(new CustomEvent('data:imported', { detail: stats }))
        if (stats.profile) {
          window.dispatchEvent(new CustomEvent('profile:imported'))
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? `Error al importar: ${e.message}` : 'Error al importar los datos'
      setImportError(msg)
      notify(msg, 'error')
      console.error(e)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Export */}
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('dataExport.exportDescription')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleExport('json')}
            disabled={exporting !== null}
            className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {exporting === 'json' ? (
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            ) : (
              <FileJson className="w-8 h-8 text-gray-400" />
            )}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('dataExport.json')}</span>
            <span className="text-xs text-gray-400">{t('dataExport.jsonDesc')}</span>
          </button>

          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting !== null}
            className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {exporting === 'xlsx' ? (
              <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-8 h-8 text-gray-400" />
            )}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('dataExport.excel')}</span>
            <span className="text-xs text-gray-400">{t('dataExport.excelDesc')}</span>
          </button>
        </div>
      </div>

      {/* Import */}
      <hr className="border-gray-200 dark:border-gray-700" />
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dataExport.importTitle')}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('dataExport.importDescription')}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.xlsx"
          onChange={handleFileSelected}
          className="hidden"
        />

        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center justify-center gap-2 w-full p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          {importing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
            <span className="text-sm font-medium">
            {importing ? t('dataExport.importing') : t('dataExport.selectFile')}
          </span>
        </button>

        {importResult && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <div className="text-sm text-green-700 dark:text-green-300">
                <p className="font-medium">{t('dataExport.importComplete')}</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {importResult.profile && <li>• {t('dataExport.profile')} {t('dataExport.updated')}</li>}
                  {importResult.jobs > 0 && <li>• {importResult.jobs} {t('dataExport.applications')} {t('dataExport.imported')}</li>}
                  {importResult.conversations > 0 && <li>• {importResult.conversations} {t('dataExport.conversations')} {t('dataExport.imported')}</li>}
                  {importResult.cvTemplates > 0 && <li>• {importResult.cvTemplates} {t('dataExport.cvTemplates')} {t('dataExport.imported')}</li>}
                  {importResult.settings && <li>• {t('dataExport.config')} {t('dataExport.updated')}</li>}
                </ul>
                <p className="text-xs mt-1 text-green-500 dark:text-green-400">
                  {importResult.filePath.split('/').pop()}
                </p>
              </div>
            </div>
          </div>
        )}

        {importError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="text-sm text-red-700 dark:text-red-300">
                <p className="font-medium">{t('dataExport.importError')}</p>
                <p className="text-xs mt-0.5">{importError}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
