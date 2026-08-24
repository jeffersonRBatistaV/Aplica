import { useApiConnection } from '../../hooks/useApiConnection'
import { useTranslation } from 'react-i18next'

export function ApiConnectionIndicator() {
  const { connected, checking } = useApiConnection()
  const { t } = useTranslation()

  if (checking) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1" title={t('layout.checking')}>
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
        <span className="text-[10px] text-gray-400">{t('layout.checking')}</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1"
      title={connected ? t('layout.online') : t('layout.offline')}
    >
      <span
        className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
      />
      <span
        className={`text-[10px] ${connected ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}
      >
        {connected ? t('layout.online') : t('layout.offline')}
      </span>
    </div>
  )
}
