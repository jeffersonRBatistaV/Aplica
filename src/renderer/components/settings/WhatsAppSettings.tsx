import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Hash, Loader2, RefreshCw, Users } from 'lucide-react'
import type { WhatsAppConfig, WhatsAppGroup } from '../../../shared/types'
import type { WhatsAppStatusEvent } from '../../types/ipc'
import { useNotification } from '../../contexts/NotificationContext'

export function WhatsAppSettings() {
  const { t } = useTranslation()
  const { notify } = useNotification()
  const [status, setStatus] = useState<WhatsAppStatusEvent>({ status: 'disconnected' })
  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [groups, setGroups] = useState<WhatsAppGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    if (!window.api) return
    setLoading(true)
    try {
      const [ev, cfg, gs] = await Promise.all([
        window.api.whatsappStatus(),
        window.api.whatsappGetConfig(),
        window.api.whatsappGetGroups(),
      ])
      setStatus(ev)
      setConfig(cfg)
      setGroups(gs)
    } catch {
      /* la lectura de estado es best-effort */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (next: WhatsAppConfig) => {
      if (!window.api) return
      setSaving(true)
      try {
        setConfig(next)
        await window.api.whatsappSetConfig(next)
        notify(t('settingsPanel.whatsappSaved'), 'success')
      } catch {
        notify(t('whatsapp.scanFailed'), 'error')
      } finally {
        setSaving(false)
      }
    },
    [notify, t],
  )

  const connected = status.status === 'connected'
  const monitored = config?.monitoredGroups ?? []

  const toggleRealtime = (value: boolean) => {
    if (!config) return
    if (value && monitored.length === 0) {
      notify(t('settingsPanel.whatsappNeedGroups'), 'info')
      return
    }
    void save({ ...config, realtime: value })
  }

  const toggleGroup = (id: string, checked: boolean) => {
    if (!config) return
    const monitoredGroups = checked ? [...monitored, id] : monitored.filter((g) => g !== id)
    void save({ ...config, monitoredGroups })
  }

  return (
    <div className="space-y-6">
      {/* Estado de conexión */}
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${
          connected
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`}
        />
        <span
          className={`text-sm flex-1 ${
            connected
              ? 'text-green-700 dark:text-green-300'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {connected ? t('settingsPanel.whatsappConnected') : t('settingsPanel.whatsappDisconnected')}
        </span>
        <button
          onClick={() => void refresh()}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!connected && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('settingsPanel.whatsappDisconnectedHint')}
        </p>
      )}

      {/* Escucha constante */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('settingsPanel.whatsappListening')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('settingsPanel.whatsappListeningDesc')}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config?.realtime ?? false}
            disabled={saving || !config}
            onChange={(e) => toggleRealtime(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 rounded-full peer bg-gray-300 dark:bg-gray-700 peer-checked:bg-green-600 peer-focus:ring-2 peer-focus:ring-green-500/40 after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      {/* Filtro estricto por área */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('settingsPanel.whatsappStrictFilter')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('settingsPanel.whatsappStrictFilterDesc')}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config?.strictAreaFilter ?? true}
            disabled={saving || !config}
            onChange={(e) => {
              if (config) void save({ ...config, strictAreaFilter: e.target.checked })
            }}
            className="sr-only peer"
          />
          <div className="w-9 h-5 rounded-full peer bg-gray-300 dark:bg-gray-700 peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-500/40 after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      {/* Grupos y canales monitoreados */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('settingsPanel.whatsappMonitoredGroups')} ({monitored.length})
          </h4>
        </div>

        {loading && groups.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            {t('whatsapp.loadingGroups')}
          </div>
        ) : groups.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            {connected ? t('settingsPanel.whatsappNoGroups') : t('settingsPanel.whatsappDisconnectedHint')}
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin pr-1">
            {groups.map((group) => (
              <label
                key={group.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  monitored.includes(group.id)
                    ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={monitored.includes(group.id)}
                  onChange={(e) => toggleGroup(group.id, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                {group.type === 'channel' ? (
                  <Hash className="w-4 h-4 text-sky-500 shrink-0" />
                ) : (
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{group.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
