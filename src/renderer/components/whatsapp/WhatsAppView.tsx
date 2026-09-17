import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Loader2, LogOut, Search, Hash, Users } from 'lucide-react'
import type { WhatsAppGroup, WhatsAppVacancy, WhatsAppConfig } from '../../../shared/types'
import type { WhatsAppServiceEvent, WhatsAppStatusEvent } from '../../types/ipc'
import { useNotification } from '../../contexts/NotificationContext'
import { Button } from '../ui/Button'
import { WhatsAppLogin } from './WhatsAppLogin'
import { WhatsAppQueue } from './WhatsAppQueue'

export function WhatsAppView() {
  const { t } = useTranslation()
  const { notify } = useNotification()

  const [statusEvent, setStatusEvent] = useState<WhatsAppStatusEvent>({ status: 'disconnected' })
  const [connecting, setConnecting] = useState(false)
  const [groups, setGroups] = useState<WhatsAppGroup[]>([])
  const [queue, setQueue] = useState<WhatsAppVacancy[]>([])
  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [phase, setPhase] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'group' | 'channel'>('all')
  const [selectionFilter, setSelectionFilter] = useState<'all' | 'selected' | 'unselected'>('selected')
  const statusRef = useRef<WhatsAppStatusEvent>({ status: 'disconnected' })
  const selectedRef = useRef<string[]>([])
  const groupsRef = useRef<WhatsAppGroup[]>([])
  const autoSelectedAllRef = useRef(false)

  statusRef.current = statusEvent
  selectedRef.current = selectedGroups
  groupsRef.current = groups

  const refreshQueue = useCallback(async () => {
    if (!window.api) return
    const q = await window.api.whatsappGetQueue()
    setQueue(q)
  }, [])

  const refreshGroups = useCallback(async () => {
    if (!window.api) return
    setLoadingGroups(true)
    try {
      const gs = await window.api.whatsappGetGroups()
      setGroups(gs)
    } finally {
      setLoadingGroups(false)
    }
  }, [])

  const handleConnect = useCallback(async () => {
    if (!window.api) return
    setConnecting(true)
    setPhase(null)
    try {
      const ev = await window.api.whatsappConnect()
      setStatusEvent(ev)
    } catch (err) {
      notify(err instanceof Error ? err.message : t('whatsapp.connectFailed'), 'error')
    } finally {
      setConnecting(false)
    }
  }, [notify, t])

  useEffect(() => {
    if (!window.api) return
    let cancelled = false
    window.api.whatsappStatus().then((ev) => {
      if (cancelled) return
      setStatusEvent(ev)
      if (ev.status === 'disconnected' && ev.hasSession) void handleConnect()
    })
    window.api.whatsappGetConfig().then((cfg) => {
      setConfig(cfg)
      setSelectedGroups(cfg.monitoredGroups)
    })
    void refreshQueue()
    return () => {
      cancelled = true
    }
  }, [refreshQueue, handleConnect])

  // Sin configuración guardada, marcar TODOS los grupos/canales por defecto
  // para que el escaneo de vacantes funcione sin pasos manuales (solo una vez).
  useEffect(() => {
    if (groups.length === 0 || !config) return
    if (autoSelectedAllRef.current) return
    if (config.monitoredGroups.length > 0) {
      autoSelectedAllRef.current = true
      return
    }
    autoSelectedAllRef.current = true
    setSelectedGroups(groups.map((g) => g.id))
  }, [groups, config])

  useEffect(() => {
    if (!window.api) return
    return window.api.onWhatsAppEvent((event: WhatsAppServiceEvent) => {
      if (event.type === 'status') setStatusEvent(event.payload)
      else if (event.type === 'vacancy') setQueue((prev) => [event.payload, ...prev])
      else if (event.type === 'phase') setPhase(event.payload)
    })
  }, [])

  useEffect(() => {
    if (statusEvent.status !== 'connected') return
    let cancelled = false
    let attempts = 0
    const RETRIES = 10
    const tick = async () => {
      if (cancelled || groupsRef.current.length > 0) return
      await refreshGroups()
      attempts += 1
      if (!cancelled && groupsRef.current.length === 0 && attempts < RETRIES) {
        setTimeout(() => void tick(), 1500 * attempts)
      }
    }
    void tick()
    return () => {
      cancelled = true
    }
  }, [statusEvent.status, refreshGroups])

  const handleDisconnect = useCallback(async () => {
    if (!window.api) return
    await window.api.whatsappDisconnect()
  }, [])

  const toggleGroup = useCallback((id: string, checked: boolean) => {
    setSelectedGroups((prev) => (checked ? [...prev, id] : prev.filter((g) => g !== id)))
  }, [])

  const handleScan = useCallback(async (limit?: number) => {
    const ids = selectedRef.current
    if (!window.api || ids.length === 0) {
      notify(t('whatsapp.noGroupsSelected'), 'info')
      return
    }
    setScanning(true)
    setPhase(null)
    try {
      const res = await window.api.whatsappScan(ids, limit)
      if (res.vacancies.length === 0) notify(t('whatsapp.scanEmpty'), 'info')
    } catch (err) {
      notify(err instanceof Error ? err.message : t('whatsapp.scanFailed'), 'error')
    } finally {
      setScanning(false)
      void refreshQueue()
    }
  }, [notify, refreshQueue, t])

  const handleSetMonitoring = useCallback(async (realtime: boolean) => {
    if (!window.api) return
    const ids = selectedRef.current
    const cfg: WhatsAppConfig = {
      monitoredGroups: ids,
      realtime,
      vacancyQueue: queue,
      processedMessageIds: [],
    }
    setConfig(cfg)
    await window.api.whatsappSetConfig(cfg)
    notify(realtime ? t('whatsapp.monitoringOn') : t('whatsapp.monitoringOff'), 'success')
  }, [notify, queue, t])

  const isConnected = statusEvent.status === 'connected'

  const filteredGroups = groups.filter(
    (g) =>
      (typeFilter === 'all' || g.type === typeFilter) &&
      (selectionFilter === 'all' ||
        (selectionFilter === 'selected' && selectedGroups.includes(g.id)) ||
        (selectionFilter === 'unselected' && !selectedGroups.includes(g.id))) &&
      g.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )

  const toggleSelectAll = useCallback(() => {
    const list = filteredGroups
    setSelectedGroups((prev) => (prev.length === list.length ? [] : list.map((g) => g.id)))
  }, [filteredGroups])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold">{t('whatsapp.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                statusEvent.status === 'connected'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                  : statusEvent.status === 'qr' || statusEvent.status === 'connecting'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  statusEvent.status === 'connected'
                    ? 'bg-green-500'
                    : statusEvent.status === 'qr' || statusEvent.status === 'connecting'
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-gray-400'
                }`}
              />
              {t(`whatsapp.status.${statusEvent.status}`)}
            </span>
            {isConnected ? (
              <Button size="sm" variant="secondary" onClick={handleDisconnect}>
                <LogOut className="w-3.5 h-3.5" />
                {t('whatsapp.disconnect')}
              </Button>
            ) : (
              <Button size="sm" onClick={handleConnect} disabled={connecting}>
                {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                {t('whatsapp.connect')}
              </Button>
            )}
          </div>
        </div>
        {phase && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{phase}</p>}
      </div>

      {!isConnected ? (
        <WhatsAppLogin statusEvent={statusEvent} connecting={connecting} onConnect={handleConnect} />
      ) : (
        <div className="flex-1 flex flex-col min-h-0 px-6 py-4 overflow-y-auto">
          {/* Grupos y canales */}
          <div className="mb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('whatsapp.targets')}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t('whatsapp.selectAll')}
                </button>
                <button
                  onClick={() => void refreshGroups()}
                  className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline"
                >
                  {t('whatsapp.refresh')}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 mb-2 flex-wrap">
              {(['all', 'group', 'channel'] as const).map((tt) => (
                <button
                  key={tt}
                  onClick={() => setTypeFilter(tt)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    typeFilter === tt
                      ? 'bg-green-600 text-white border-green-600'
                      : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {t(
                    tt === 'all'
                      ? 'whatsapp.filterAll'
                      : tt === 'group'
                        ? 'whatsapp.filterGroups'
                        : 'whatsapp.filterChannels',
                  )}
                </button>
              ))}
              <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
              {(['all', 'selected', 'unselected'] as const).map((sf) => (
                <button
                  key={sf}
                  onClick={() => setSelectionFilter(sf)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    selectionFilter === sf
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {t(
                    sf === 'all'
                      ? 'whatsapp.filterAll'
                      : sf === 'selected'
                        ? 'whatsapp.filterSelected'
                        : 'whatsapp.filterUnselected',
                  )}
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-400">
                {filteredGroups.length}/{groups.length}
              </span>
            </div>

            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('whatsapp.searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500/40"
              />
            </div>

            {loadingGroups && groups.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                {t('whatsapp.loadingGroups')}
              </div>
            ) : groups.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                {t('whatsapp.noTargets')}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                {t('whatsapp.noSearchResults')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredGroups.map((group) => (
                  <label
                    key={group.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedGroups.includes(group.id)
                        ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.id)}
                      onChange={(e) => toggleGroup(group.id, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    {group.type === 'channel' ? (
                      <Hash className="w-4 h-4 text-sky-500 shrink-0" />
                    ) : (
                      <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{group.name}</span>
                    <span className="ml-auto text-[10px] shrink-0 text-gray-400 dark:text-gray-500">
                      {group.type === 'channel' ? t('whatsapp.channel') : t('whatsapp.group')}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <Button
              onClick={() => void handleScan()}
              disabled={scanning || selectedGroups.length === 0}
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              {t('whatsapp.scan')}
            </Button>
            <Button
              variant={config?.realtime ? 'primary' : 'secondary'}
              onClick={() => void handleSetMonitoring(!config?.realtime)}
              disabled={selectedGroups.length === 0}
            >
              {config?.realtime ? <Loader2 className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
              {config?.realtime ? t('whatsapp.monitoringActive') : t('whatsapp.enableMonitoring')}
            </Button>
            <Button variant="secondary" onClick={() => void handleScan(200)} disabled={scanning || selectedGroups.length === 0}>
              {t('whatsapp.scanDeep')}
            </Button>
          </div>

          {/* Cola de revisión */}
          <WhatsAppQueue vacancies={queue} onImported={refreshQueue} />
        </div>
      )}
    </div>
  )
}