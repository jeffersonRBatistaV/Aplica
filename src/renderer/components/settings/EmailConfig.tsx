import { useEffect, useState } from 'react'
import { Mail, Eye, EyeOff, Check, Loader2, X, HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../contexts/SettingsContext'
import { useNotification } from '../../contexts/NotificationContext'
import { Button } from '../ui/Button'
import type { EmailConfig as EmailConfigType } from '../../../shared/types'

const GMAIL_PRESET = { host: 'smtp.gmail.com', port: 587, secure: false }

export function EmailConfig() {
  const { t } = useTranslation()
  const { notify } = useNotification()
  const { settings, updateSettings } = useSettings()
  const cfg = settings.emailConfig ?? {
    provider: 'gmail' as const,
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromName: '',
    configured: false,
  }

  const [user, setUser] = useState(cfg.user || '')
  const [pass, setPass] = useState(cfg.pass || '')
  const [fromName, setFromName] = useState(cfg.fromName || '')
  const [showPass, setShowPass] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  useEffect(() => {
    setUser(cfg.user || '')
    setPass(cfg.pass || '')
    window.api.getProfile().then((profile) => {
      setFromName(profile?.name || cfg.fromName || '')
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.emailConfig?.user, settings.emailConfig?.pass, settings.emailConfig?.fromName])

  const buildConfig = (): EmailConfigType => ({
    provider: 'gmail',
    host: GMAIL_PRESET.host,
    port: GMAIL_PRESET.port,
    secure: GMAIL_PRESET.secure,
    user: user.trim(),
    pass: pass.trim(),
    fromName: fromName.trim(),
    configured: !!(user.trim() && pass.trim()),
  })

  const handleTest = async () => {
    const config = buildConfig()
    if (!config.user || !config.pass) {
      setTestState('error')
      setTestError(t('emailConfig.fillFields'))
      return
    }
    setTesting(true)
    setTestState('idle')
    setTestError('')
    try {
      const result = await window.api.testEmailConnection(config)
      if (result.ok) {
        setTestState('ok')
        notify(t('emailConfig.connectionOk'), 'success')
      } else {
        setTestState('error')
        setTestError(result.error || t('emailConfig.connError'))
      }
    } catch {
      setTestState('error')
      setTestError(t('emailConfig.connError'))
    } finally {
      setTesting(false)
    }
  }

  const save = (next: EmailConfigType) => {
    updateSettings({ emailConfig: next })
  }

  const handleUserBlur = () => save(buildConfig())
  const handlePassBlur = () => save(buildConfig())

  const configuredNow = !!(user.trim() && pass.trim())

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Mail className="w-4 h-4 text-blue-500" />
        {t('emailConfig.title')}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('emailConfig.subtitle')}</p>

      {/* Provider (Gmail fijo) */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <span className="text-sm text-gray-700 dark:text-gray-300">Gmail</span>
        <span className="text-xs text-gray-400">{t('emailConfig.gmailPreset')}</span>
      </div>

      {/* Nombre del remitente (tomado del perfil, no editable aquí) */}
      {fromName && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <span className="text-sm text-gray-700 dark:text-gray-300">{fromName}</span>
          <span className="text-xs text-gray-400">{t('emailConfig.fromProfile')}</span>
        </div>
      )}

      {/* Email del usuario */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('emailConfig.user')}
        </label>
        <input
          type="email"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          onBlur={handleUserBlur}
          placeholder="tucorreo@gmail.com"
          className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {/* App Password */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('emailConfig.appPassword')}
          </label>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {t('emailConfig.howToGet')}
          </button>
        </div>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onBlur={handlePassBlur}
            placeholder="xxxx xxxx xxxx xxxx"
            className="w-full px-3 py-2 pr-10 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Test connection */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing}>
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {t('emailConfig.testConnection')}
        </Button>
        {configuredNow && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Check className="w-3.5 h-3.5" />
            {t('emailConfig.configured')}
          </span>
        )}
      </div>

      {testState === 'error' && testError && (
        <p className="flex items-start gap-1 text-xs text-red-500">
          <X className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {testError}
        </p>
      )}

      {showHelp && (
        <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 space-y-2">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{t('emailConfig.helpTitle')}</p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700 dark:text-blue-300">
            <li>{t('emailConfig.helpStep1')}</li>
            <li>{t('emailConfig.helpStep2')}</li>
            <li>{t('emailConfig.helpStep3')}</li>
          </ol>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              https://myaccount.google.com/apppasswords
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
