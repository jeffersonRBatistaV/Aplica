import { useState } from 'react'
import { FileJson, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useNotification } from '../../contexts/NotificationContext'

export function DataExport() {
  const { notify } = useNotification()
  const [exporting, setExporting] = useState<'json' | 'xlsx' | null>(null)

  const handleExport = async (format: 'json' | 'xlsx') => {
    setExporting(format)
    try {
      const data = await window.api.exportAll()
      const path = await window.api.saveExportFile(data, format)
      if (path) {
        notify(`Datos exportados: ${path.split('/').pop()}`, 'success')
      }
    } catch (e) {
      notify('Error al exportar los datos', 'error')
      console.error(e)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Exporta todos tus datos (perfil, conversaciones, postulaciones, plantillas CV) en formato JSON o Excel.
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
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">JSON</span>
          <span className="text-xs text-gray-400">Datos completos sin procesar</span>
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
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Excel</span>
          <span className="text-xs text-gray-400">Tablas organizadas por categoría</span>
        </button>
      </div>
    </div>
  )
}
