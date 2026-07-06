import { useState } from 'react'
import { Cloud, Loader2, Check } from 'lucide-react'
import { ApiConfig } from './ApiConfig'
import { useSettings } from '../../contexts/SettingsContext'
import { useTranslation } from 'react-i18next'

interface ApiSetupModalProps {
  onComplete: () => void
}

export function ApiSetupModal({ onComplete }: ApiSetupModalProps) {
  const { t } = useTranslation()
  const { settings, updateSettings } = useSettings()
  const [baseUrl, setBaseUrl] = useState(settings.api.baseUrl)
  const [apiKey, setApiKey] = useState(settings.api.apiKey)
  const [model, setModel] = useState(settings.api.model)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (config: { baseUrl: string; apiKey: string; model: string }) => {
    setBaseUrl(config.baseUrl)
    setApiKey(config.apiKey)
    setModel(config.model)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateSettings({
        api: { baseUrl, apiKey, model, configured: true },
      })
      onComplete()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar configuración'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{t('apiSetupModal.title')}</h2>
            <p className="text-xs text-gray-400">{t('apiSetupModal.subtitle')}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
          {error && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              <span>{error}</span>
            </div>
          )}

          <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">{t('apiSetupModal.beforeStart')}</p>
            <p>{t('apiSetupModal.instruction')}</p>
          </div>

          <ApiConfig
            baseUrl={baseUrl}
            apiKey={apiKey}
            model={model}
            onChange={handleChange}
          />
        </div>

        <div className="px-6 py-4 border-t">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {saving ? t('apiSetupModal.saving') : t('apiSetupModal.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
