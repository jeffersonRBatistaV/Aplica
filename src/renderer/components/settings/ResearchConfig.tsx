import { useState } from 'react'
import { Search, TestTube, CheckCircle, XCircle, Globe, Key, Timer, Hash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { InvestigateConfig } from '../../../shared/types'

interface ResearchConfigProps {
  config: InvestigateConfig
  onChange: (config: InvestigateConfig) => void
}

const PROVIDERS = ['auto', 'duckduckgo', 'searxng', 'bing', 'brave', 'google'] as const

export function ResearchConfig({ config, onChange }: ResearchConfigProps) {
  const { t } = useTranslation()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const update = (partial: Partial<InvestigateConfig>) => {
    onChange({ ...config, ...partial })
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.investigate('salario promedio desarrollador software 2026', 'DO', 'es')
      setTestResult({
        ok: true,
        msg: t('researchConfig.testSuccess', { count: result.sources?.length || 0 }),
      })
    } catch (e) {
      setTestResult({ ok: false, msg: t('researchConfig.testError', { msg: e instanceof Error ? e.message : String(e) }) })
    } finally {
      setTesting(false)
    }
  }

  const hasKeys = !!(config.braveApiKey || (config.googleApiKey && config.googleSearchEngineId))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Search className="w-4 h-4" />
          {t('researchConfig.title')}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('researchConfig.desc')}</p>
      </div>

      {/* Estado */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <div className={`w-2 h-2 rounded-full ${hasKeys ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {t('researchConfig.status')}:{' '}
          {hasKeys ? t('researchConfig.statusReady') : t('researchConfig.statusDuckDuckGoOnly')}
        </span>
      </div>

      {/* Motor de búsqueda */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('researchConfig.searchProvider')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => update({ searchProvider: p })}
              className={`p-2 rounded-lg border text-xs font-medium text-left transition-all ${
                config.searchProvider === p
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
              }`}
            >
              {t(`researchConfig.searchProvider${p.charAt(0).toUpperCase() + p.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {/* API Keys condicionales */}
      {(config.searchProvider === 'auto' || config.searchProvider === 'brave') && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Key className="w-3 h-3 inline mr-1" />
              {t('researchConfig.braveApiKey')}
            </label>
            <input
              type="password"
              value={config.braveApiKey || ''}
              onChange={(e) => update({ braveApiKey: e.target.value || undefined })}
              placeholder="BSA..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-[11px] text-gray-400 mt-1">{t('researchConfig.braveApiKeyDesc')}</p>
          </div>
        </div>
      )}

      {(config.searchProvider === 'auto' || config.searchProvider === 'google') && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Key className="w-3 h-3 inline mr-1" />
              {t('researchConfig.googleApiKey')}
            </label>
            <input
              type="password"
              value={config.googleApiKey || ''}
              onChange={(e) => update({ googleApiKey: e.target.value || undefined })}
              placeholder="AIza..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Globe className="w-3 h-3 inline mr-1" />
              {t('researchConfig.googleSearchEngineId')}
            </label>
            <input
              type="text"
              value={config.googleSearchEngineId || ''}
              onChange={(e) => update({ googleSearchEngineId: e.target.value || undefined })}
              placeholder="a1b2c3..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-[11px] text-gray-400 mt-1">{t('researchConfig.googleDesc')}</p>
          </div>
        </div>
      )}

      {/* Parámetros avanzados */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Hash className="w-3 h-3 inline mr-1" />
              {t('researchConfig.maxResults')}
            </label>
            <input
              type="number"
              min={3}
              max={15}
              value={config.maxSearchResults}
              onChange={(e) => update({ maxSearchResults: Number(e.target.value) || 8 })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('researchConfig.maxChars')}
            </label>
            <input
              type="number"
              min={5000}
              max={50000}
              step={1000}
              value={config.maxExtractChars}
              onChange={(e) => update({ maxExtractChars: Number(e.target.value) || 15000 })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Timer className="w-3 h-3 inline mr-1" />
              {t('researchConfig.searchTimeout')}
            </label>
            <input
              type="number"
              min={5000}
              max={30000}
              step={1000}
              value={config.searchTimeout}
              onChange={(e) => update({ searchTimeout: Number(e.target.value) || 10000 })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Timer className="w-3 h-3 inline mr-1" />
              {t('researchConfig.extractTimeout')}
            </label>
            <input
              type="number"
              min={5000}
              max={60000}
              step={1000}
              value={config.extractTimeout}
              onChange={(e) => update({ extractTimeout: Number(e.target.value) || 15000 })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Botón probar */}
      <div>
        <button
          onClick={handleTest}
          disabled={testing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {testing ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              {t('researchConfig.testing')}
            </>
          ) : (
            <>
              <TestTube className="w-4 h-4" />
              {t('researchConfig.testSearch')}
            </>
          )}
        </button>
        <p className="text-[11px] text-gray-400 mt-1 text-center">{t('researchConfig.testSearchDesc')}</p>
        {testResult && (
          <div
            className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
              testResult.ok
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            }`}
          >
            {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {testResult.msg}
          </div>
        )}
      </div>
    </div>
  )
}
