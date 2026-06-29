import { useState } from 'react'
import { FileJson, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { useNotification } from '../../contexts/NotificationContext'

export function DataExport() {
  const { notify } = useNotification()
  const [exporting, setExporting] = useState<'json' | 'xlsx' | null>(null)
  const [importing, setImporting] = useState(false)

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

  const handleImport = async () => {
    setImporting(true)
    try {
      const result = await window.api.importFromFile()
      if (!result) {
        // cancelled
      } else if (result.startsWith('error:')) {
        notify('El archivo no es un JSON de exportación válido', 'error')
      } else {
        notify(`Datos importados desde ${result.split('/').pop()}`, 'success')
      }
    } catch (e) {
      notify('Error al importar los datos', 'error')
      console.error(e)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Export */}
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
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

      {/* Import */}
      <hr className="border-gray-200 dark:border-gray-700" />
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Importar datos</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Selecciona un archivo JSON o Excel previamente exportado para restaurar tus datos. Las conversaciones y postulaciones se fusionan sin duplicar.
        </p>
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
            {importing ? 'Importando...' : 'Seleccionar archivo JSON o Excel'}
          </span>
        </button>
      </div>
    </div>
  )
}
