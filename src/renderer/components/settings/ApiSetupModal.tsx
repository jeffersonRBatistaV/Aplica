import { useState, useCallback } from 'react'
import { Loader2, Check, Laptop, KeyRound, Settings2, ArrowLeft, RefreshCw, ExternalLink, Copy, AlertCircle, X } from 'lucide-react'
import { ApiConfig } from './ApiConfig'
import { useSettings } from '../../contexts/SettingsContext'
import { useTranslation } from 'react-i18next'
import { friendlyMessage } from '../../lib/friendly-error'
import type { ModelInfo } from '../../types/ipc'

interface ApiSetupModalProps {
  onComplete: () => void
  /** Permite cerrar sin configurar (desde Ajustes). */
  onCancel?: () => void
}

type Mode = 'choose' | 'local' | 'key' | 'advanced'

const OLLAMA_URL = 'http://localhost:11434/v1'
/** Modelos locales que funcionan bien para redactar CVs y cartas, por orden de preferencia. */
const LOCAL_PREFERRED = ['qwen2.5', 'qwen3', 'llama3.1', 'llama3.2', 'gemma3', 'gemma2', 'mistral', 'phi']

interface KeyProvider {
  id: string
  label: string
  baseUrl: string
  keyUrl: string
  preferred: string[]
  free?: boolean
}

const KEY_PROVIDERS: KeyProvider[] = [
  { id: 'google', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey', preferred: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'], free: true },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', preferred: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'], free: true },
  { id: 'openai', label: 'OpenAI (ChatGPT)', baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', preferred: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'] },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', preferred: ['openai/gpt-4o-mini', 'google/gemini-2.0-flash'] },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys', preferred: ['deepseek-chat'] },
]

function pickModel(models: ModelInfo[], preferred: string[]): string {
  const usable = models.filter((m) => !/embed|whisper|tts|dall-e|moderation|rerank/i.test(m.id))
  const pool = usable.length ? usable : models
  for (const pref of preferred) {
    const hit = pool.find((m) => m.id.toLowerCase().includes(pref.toLowerCase()))
    if (hit) return hit.id
  }
  return pool[0]?.id ?? ''
}

export function ApiSetupModal({ onComplete, onCancel }: ApiSetupModalProps) {
  const { t } = useTranslation()
  const { settings, updateSettings } = useSettings()
  const [mode, setMode] = useState<Mode>('choose')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Local (Ollama) ──
  const [detecting, setDetecting] = useState(false)
  const [localModels, setLocalModels] = useState<ModelInfo[] | null>(null)
  const [localModel, setLocalModel] = useState('')
  const [copied, setCopied] = useState(false)

  // ── Clave de proveedor ──
  const [provider, setProvider] = useState<KeyProvider>(KEY_PROVIDERS[0])
  const [key, setKey] = useState('')
  const [validating, setValidating] = useState(false)
  const [keyModels, setKeyModels] = useState<ModelInfo[] | null>(null)
  const [keyModel, setKeyModel] = useState('')

  // ── Avanzado (formulario completo) ──
  const [baseUrl, setBaseUrl] = useState(settings.api.baseUrl)
  const [apiKey, setApiKey] = useState(settings.api.apiKey)
  const [model, setModel] = useState(settings.api.model)
  const [visionModel, setVisionModel] = useState(settings.api.visionModel)
  const [maxContextTokens, setMaxContextTokens] = useState(settings.api.maxContextTokens ?? 32768)

  const detectLocal = useCallback(async () => {
    if (!window.api) return
    setDetecting(true)
    setError(null)
    try {
      const models = await window.api.listModels({ baseUrl: OLLAMA_URL, apiKey: '' })
      setLocalModels(models)
      setLocalModel(pickModel(models, LOCAL_PREFERRED))
    } catch {
      setLocalModels([])
    } finally {
      setDetecting(false)
    }
  }, [])

  const chooseLocal = () => {
    setMode('local')
    void detectLocal()
  }

  const validateKey = async () => {
    if (!window.api || !key.trim()) return
    setValidating(true)
    setError(null)
    setKeyModels(null)
    try {
      const models = await window.api.listModels({ baseUrl: provider.baseUrl, apiKey: key.trim() })
      if (models.length === 0) {
        setError(t('aiSetup.keyInvalid'))
        return
      }
      setKeyModels(models)
      setKeyModel(pickModel(models, provider.preferred))
    } catch (err) {
      setError(friendlyMessage(err))
    } finally {
      setValidating(false)
    }
  }

  const save = async (api: { baseUrl: string; apiKey: string; model: string; visionModel?: string; maxContextTokens?: number }) => {
    setSaving(true)
    setError(null)
    try {
      await updateSettings({
        api: {
          ...settings.api,
          ...api,
          visionModel: api.visionModel ?? settings.api.visionModel,
          maxContextTokens: api.maxContextTokens ?? settings.api.maxContextTokens ?? 32768,
          configured: true,
        },
      })
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? friendlyMessage(err) : t('aiSetup.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const copyCommand = async (cmd: string) => {
    try {
      await window.api?.copyToClipboard(cmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* noop */ }
  }

  const goBack = () => { setMode('choose'); setError(null) }

  const optionCard = (icon: typeof Laptop, title: string, desc: string, badge: string | null, onClick: () => void) => {
    const Icon = icon
    return (
      <button
        onClick={onClick}
        className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 text-left transition-all"
      >
        <div className="w-10 h-10 shrink-0 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
          <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</span>
            {badge && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">{badge}</span>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
        </div>
      </button>
    )
  }

  const footerButton = (label: string, onClick: () => void, disabled: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled || saving}
      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
    >
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
      {saving ? t('apiSetupModal.saving') : label}
    </button>
  )

  const stepBadge = (n: number) => (
    <span className="w-5 h-5 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center">{n}</span>
  )

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col mx-4">
        <div className="flex items-center gap-2 px-6 py-4 border-b">
          {mode !== 'choose' && (
            <button onClick={goBack} className="p-1 -ml-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('aiSetup.back')}>
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{t('apiSetupModal.title')}</h2>
            <p className="text-xs text-gray-400">{t('aiSetup.subtitle')}</p>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('sendCv.cancel')}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'choose' && (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('aiSetup.intro')}</p>
              {optionCard(KeyRound, t('aiSetup.keyTitle'), t('aiSetup.keyDesc'), t('aiSetup.recommended'), () => setMode('key'))}
              {optionCard(Laptop, t('aiSetup.localTitle'), t('aiSetup.localDesc'), t('aiSetup.free'), chooseLocal)}
              {optionCard(Settings2, t('aiSetup.advancedTitle'), t('aiSetup.advancedDesc'), null, () => setMode('advanced'))}
            </>
          )}

          {mode === 'local' && (
            <>
              {detecting && (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('aiSetup.detecting')}
                </div>
              )}

              {!detecting && localModels && localModels.length > 0 && (
                <>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{t('aiSetup.localFound', { count: localModels.length })}</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('aiSetup.whichModel')}</label>
                    <select
                      value={localModel}
                      onChange={(e) => setLocalModel(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                    >
                      {localModels.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">{t('aiSetup.modelHint')}</p>
                  </div>
                </>
              )}

              {!detecting && localModels && localModels.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{t('aiSetup.localNotFound')}</p>
                  <ol className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex gap-2">
                      {stepBadge(1)}
                      <span>
                        {t('aiSetup.localStep1')}{' '}
                        <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 underline">
                          ollama.com/download <ExternalLink className="w-3 h-3" />
                        </a>
                      </span>
                    </li>
                    <li className="flex gap-2">
                      {stepBadge(2)}
                      <div className="flex-1">
                        <span>{t('aiSetup.localStep2')}</span>
                        <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 font-mono text-xs">
                          <span className="flex-1">ollama pull qwen2.5:7b</span>
                          <button onClick={() => copyCommand('ollama pull qwen2.5:7b')} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200" aria-label={t('cvGenerator.copy')}>
                            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      {stepBadge(3)}
                      <span>{t('aiSetup.localStep3')}</span>
                    </li>
                  </ol>
                  <button
                    onClick={detectLocal}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('aiSetup.retry')}
                  </button>
                </div>
              )}
            </>
          )}

          {mode === 'key' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('aiSetup.whichProvider')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {KEY_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setProvider(p); setKeyModels(null); setError(null) }}
                      className={`px-3 py-2 rounded-lg border-2 text-left text-sm transition-all ${
                        provider.id === p.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200">{p.label}</span>
                      {p.free && <span className="block text-[11px] text-green-600 dark:text-green-400">{t('aiSetup.freeTier')}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 w-full px-4 py-2 text-sm font-medium rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <ExternalLink className="w-4 h-4" />
                {t('aiSetup.getKey', { provider: provider.label })}
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">{t('aiSetup.getKeyHint')}</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('aiSetup.pasteKey')}</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={key}
                    onChange={(e) => { setKey(e.target.value); setKeyModels(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void validateKey() }}
                    placeholder="sk-…"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <button
                    onClick={validateKey}
                    disabled={!key.trim() || validating}
                    className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('aiSetup.check')}
                  </button>
                </div>
              </div>

              {keyModels && keyModels.length > 0 && (
                <>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{t('aiSetup.keyOk')}</span>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-xs text-gray-500">{t('aiSetup.changeModel', { model: keyModel })}</summary>
                    <select
                      value={keyModel}
                      onChange={(e) => setKeyModel(e.target.value)}
                      className="mt-2 w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                    >
                      {keyModels.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
                    </select>
                  </details>
                </>
              )}
            </>
          )}

          {mode === 'advanced' && (
            <ApiConfig
              baseUrl={baseUrl}
              apiKey={apiKey}
              model={model}
              visionModel={visionModel}
              onChange={(c) => {
                setBaseUrl(c.baseUrl)
                setApiKey(c.apiKey)
                setModel(c.model)
                setVisionModel(c.visionModel)
                setMaxContextTokens(c.maxContextTokens ?? 32768)
              }}
            />
          )}
        </div>

        <div className="px-6 py-4 border-t space-y-2">
          {mode === 'local' && footerButton(t('aiSetup.useLocal'), () => save({ baseUrl: OLLAMA_URL, apiKey: '', model: localModel }), !localModel || detecting)}
          {mode === 'key' && footerButton(t('aiSetup.useKey'), () => save({ baseUrl: provider.baseUrl, apiKey: key.trim(), model: keyModel }), !keyModels?.length || !keyModel)}
          {mode === 'advanced' && footerButton(t('apiSetupModal.save'), () => save({ baseUrl, apiKey, model, visionModel, maxContextTokens }), !baseUrl.trim())}
          {mode === 'choose' && (
            <button
              onClick={onCancel ?? onComplete}
              className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {t('aiSetup.later')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
