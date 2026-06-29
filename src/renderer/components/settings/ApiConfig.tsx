import { useState, useEffect, useCallback, useRef } from 'react'
import { Eye, EyeOff, RefreshCw, Check, AlertCircle, Trash2, DollarSign } from 'lucide-react'
import type { ModelInfo } from '../../types/ipc'
import type { UsageStats } from '../../../shared/types'

interface ApiConfigProps {
  baseUrl: string
  apiKey: string
  model: string
  onChange: (config: { baseUrl: string; apiKey: string; model: string }) => void
}

export function ApiConfig({ baseUrl, apiKey, model, onChange }: ApiConfigProps) {
  const [localBaseUrl, setLocalBaseUrl] = useState(baseUrl)
  const [localApiKey, setLocalApiKey] = useState(apiKey)
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)
  const prevUrlRef = useRef(baseUrl)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const mountedRef = useRef(false)

  const fetchModels = useCallback(async (url: string, key: string) => {
    if (!window.api || !url.trim()) return
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('localhost')) return
    setLoadingModels(true)
    setModelError(null)
    try {
      const result = await window.api.listModels({ baseUrl: url, apiKey: key })
      if (result.length === 0) {
        setModelError('No se encontraron modelos disponibles')
      } else {
        setModels(result)
        const current = result.find((m: ModelInfo) => m.id === model || m.name === model)
        if (!current || !model) {
          onChange({ baseUrl: url, apiKey: key, model: result[0].id })
        }
      }
    } catch {
      setModelError('No se pudieron cargar los modelos. Verifica la URL e intenta de nuevo.')
    } finally {
      setLoadingModels(false)
    }
  }, [model, onChange])

  useEffect(() => {
    if (mountedRef.current) {
      if (baseUrl && baseUrl !== prevUrlRef.current) {
        prevUrlRef.current = baseUrl
        if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
          fetchModels(baseUrl, apiKey)
        }
      }
    } else {
      mountedRef.current = true
      if (baseUrl && (baseUrl.startsWith('http://') || baseUrl.startsWith('https://'))) {
        prevUrlRef.current = baseUrl
        fetchModels(baseUrl, apiKey)
      }
    }
  }, [baseUrl, apiKey, fetchModels])

  const scheduleFetch = useCallback((url: string, key: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchModels(url, key)
    }, 600)
  }, [fetchModels])

  const handleSaveUrl = () => {
    const url = localBaseUrl.trim()
    onChange({ baseUrl: url, apiKey: localApiKey, model })
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      fetchModels(url, localApiKey)
    }
  }

  const handleSaveKey = () => {
    onChange({ baseUrl: localBaseUrl, apiKey: localApiKey, model })
  }

  const handleUrlChange = (value: string) => {
    setLocalBaseUrl(value)
    if (value.trim().startsWith('http://') || value.trim().startsWith('https://')) {
      scheduleFetch(value.trim(), localApiKey)
    }
  }

  const handleKeyChange = (value: string) => {
    setLocalApiKey(value)
    if (localBaseUrl.trim().startsWith('http://') || localBaseUrl.trim().startsWith('https://')) {
      scheduleFetch(localBaseUrl.trim(), value)
    }
  }

  const canFetch = localBaseUrl.trim().startsWith('http://') || localBaseUrl.trim().startsWith('https://')

  return (
    <div className="space-y-4">
      {/* Base URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Base URL
        </label>
        <input
          type="url"
          value={localBaseUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          onBlur={handleSaveUrl}
          placeholder="http://localhost:11434/v1"
          className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        <p className="text-xs text-gray-400 mt-1">
          Ej: https://api.openai.com/v1, https://api.groq.com/openai/v1
        </p>
      </div>

      {/* API Key */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          API Key
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={localApiKey}
            onChange={(e) => handleKeyChange(e.target.value)}
            onBlur={handleSaveKey}
            placeholder="sk-..."
            className="w-full px-3 py-2 pr-10 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Model selector */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Modelo
          </label>
          <button
            onClick={() => fetchModels(localBaseUrl, localApiKey)}
            disabled={loadingModels || !canFetch}
            className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} />
            Recargar
          </button>
        </div>

        <select
          value={model}
          onChange={(e) => onChange({ baseUrl: localBaseUrl, apiKey: localApiKey, model: e.target.value })}
          disabled={loadingModels}
          className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingModels ? (
            <option value="">Cargando modelos...</option>
          ) : models.length > 0 ? (
            models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id}
              </option>
            ))
          ) : !canFetch ? (
            <option value="">Ingresa una URL válida primero</option>
          ) : modelError ? (
            <option value={model || ''}>{model || 'Error al cargar'} {model ? '(usando valor manual)' : ''}</option>
          ) : (
            <option value="">Sin modelos disponibles</option>
          )}
        </select>

        {modelError && (
          <p className="flex items-center gap-1 mt-1 text-xs text-red-500">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {modelError}
          </p>
        )}

        {loadingModels && (
          <p className="flex items-center gap-1 mt-1 text-xs text-blue-500">
            <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
            Cargando modelos...
          </p>
        )}

        {!loadingModels && models.length > 0 && (
          <p className="flex items-center gap-1 mt-1 text-xs text-green-500">
            <Check className="w-3 h-3 shrink-0" />
            {models.length} modelo{models.length !== 1 ? 's' : ''} disponible{models.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Consumo de API */}
      <ConsumptionSection />
    </div>
  )
}

function ConsumptionSection() {
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUsage = useCallback(async () => {
    if (!window.api) return
    setLoading(true)
    try {
      const data = await window.api.getUsage()
      setUsage(data)
    } catch {
      setUsage(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsage()
  }, [loadUsage])

  const handleReset = async () => {
    if (!window.confirm('¿Restablecer todas las estadísticas de consumo?')) return
    try {
      await window.api.resetUsage()
      setUsage({ totalPromptTokens: 0, totalCompletionTokens: 0, totalCost: 0, records: [] })
    } catch { /* */ }
  }

  if (loading) {
    return (
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Consumo de API</h4>
        <p className="text-xs text-gray-400">Cargando estadísticas...</p>
      </div>
    )
  }

  const fmt = (n: number) => n.toLocaleString('es')
  const totalTokens = (usage?.totalPromptTokens ?? 0) + (usage?.totalCompletionTokens ?? 0)

  return (
    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Consumo de API</h4>
        {(usage?.records?.length ?? 0) > 0 && (
          <button onClick={handleReset} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
            <Trash2 className="w-3 h-3" />
            Restablecer
          </button>
        )}
      </div>

      {!usage || usage.records.length === 0 ? (
        <p className="text-xs text-gray-400">No hay consumo registrado aún.</p>
      ) : (
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Tokens de entrada</span>
            <span className="font-mono text-gray-800 dark:text-gray-200">{fmt(usage.totalPromptTokens)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Tokens de salida</span>
            <span className="font-mono text-gray-800 dark:text-gray-200">{fmt(usage.totalCompletionTokens)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-2">
            <span className="font-medium text-gray-600 dark:text-gray-300">Total</span>
            <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{fmt(totalTokens)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <DollarSign className="w-3 h-3" />
              Costo estimado
            </span>
            <span className="font-mono text-gray-800 dark:text-gray-200">
              ${usage.totalCost.toFixed(4)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
