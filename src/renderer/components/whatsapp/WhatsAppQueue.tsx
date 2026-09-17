import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Inbox, Briefcase, Loader2, Building2, Image, Mail, MessageCircle, Phone, Link2, Trash2, X } from 'lucide-react'
import type { WhatsAppVacancy } from '../../../shared/types'
import { useNavigation } from '../../contexts/AppContext'
import { useNotification } from '../../contexts/NotificationContext'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface WhatsAppQueueProps {
  vacancies: WhatsAppVacancy[]
  onImported: () => void
}

export function WhatsAppQueue({ vacancies, onImported }: WhatsAppQueueProps) {
  const { t } = useTranslation()
  const { setCurrentView } = useNavigation()
  const { notify } = useNotification()
  const [importingId, setImportingId] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'group' | 'channel'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [expandedSnippet, setExpandedSnippet] = useState<Set<string>>(new Set())

  const targetType = (gid: string): 'group' | 'channel' => (gid.endsWith('@newsletter') ? 'channel' : 'group')
  const filtered = sourceFilter === 'all' ? vacancies : vacancies.filter((v) => targetType(v.groupId) === sourceFilter)

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (!id || !window.api) return
      void window.api.whatsappMarkImported(id).then(() => onImported())
    }
    window.addEventListener('aplica:whatsappImported', handler)
    return () => window.removeEventListener('aplica:whatsappImported', handler)
  }, [onImported])

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => vacancies.some((v) => v.id === id)))
      return next.size === prev.size ? prev : next
    })
  }, [vacancies])

  const handleImport = async (vacancy: WhatsAppVacancy) => {
    setImportingId(vacancy.id)
    try {
      window.dispatchEvent(new CustomEvent('aplica:vacancyImport', { detail: vacancy }))
      setCurrentView('jobs')
    } catch {
      notify(t('whatsapp.importFailed'), 'error')
    } finally {
      setImportingId(null)
    }
  }

  const handleDelete = async (vacancyId: string) => {
    if (!window.api) return
    setDeletingId(null)
    try {
      await window.api.whatsappRemoveFromQueue(vacancyId)
      notify(t('whatsapp.deleted'), 'success')
      onImported()
    } catch {
      notify(t('whatsapp.importFailed'), 'error')
    }
  }

  const handleDeleteMany = async () => {
    if (!window.api) return
    setConfirmBulk(false)
    const ids = [...selectedIds]
    try {
      await window.api.whatsappRemoveFromQueueMany(ids)
      notify(t('whatsapp.deletedMany', { count: ids.length }), 'success')
      setSelectedIds(new Set())
      onImported()
    } catch {
      notify(t('whatsapp.importFailed'), 'error')
    }
  }

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((v) => prev.has(v.id))
      const next = new Set(prev)
      for (const v of filtered) {
        if (allSelected) next.delete(v.id)
        else next.add(v.id)
      }
      return next
    })
  }

  const dateLabel = (ts: number) =>
    new Date(ts).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  if (vacancies.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
        <Inbox className="w-10 h-10 mx-auto mb-3" />
        <p>{t('whatsapp.emptyQueue')}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('whatsapp.queue')} ({filtered.length}/{vacancies.length})
        </h3>
        <button onClick={onImported} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          {t('whatsapp.refresh')}
        </button>
      </div>

      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {(['all', 'group', 'channel'] as const).map((src) => (
          <button
            key={src}
            onClick={() => setSourceFilter(src)}
            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
              sourceFilter === src
                ? 'bg-green-600 text-white border-green-600'
                : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {t(
              src === 'all'
                ? 'whatsapp.filterAll'
                : src === 'group'
                  ? 'whatsapp.filterGroups'
                  : 'whatsapp.filterChannels',
            )}
          </button>
        ))}
        <button
          onClick={toggleSelectAllFiltered}
          className="ml-auto text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('whatsapp.selectAllFiltered')}
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
          <span className="text-xs font-medium text-red-700 dark:text-red-300 flex-1">
            {t('whatsapp.selectedCount', { count: selectedIds.size })}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setConfirmBulk(true)}>
            <Trash2 className="w-3.5 h-3.5" />
            {t('whatsapp.deleteSelected')}
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">{t('whatsapp.noSearchResults')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((vacancy) => {
            const isSelected = selectedIds.has(vacancy.id)
            return (
              <div
                key={vacancy.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isSelected
                    ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-600'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelected(vacancy.id, e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{vacancy.title}</h4>
                        {vacancy.company && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Building2 className="w-3.5 h-3.5" />
                            {vacancy.company}
                          </span>
                        )}
                        {vacancy.category && (
                          <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            {vacancy.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {vacancy.groupName}
                        </span>
                        <span>·</span>
                        <span>{dateLabel(vacancy.messageTime)}</span>
                        {vacancy.hasImage && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Image className="w-3 h-3" />
                              {t('whatsapp.hasImage')}
                            </span>
                          </>
                        )}
                        {vacancy.email && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <Mail className="w-3 h-3" />
                              {vacancy.email}
                            </span>
                          </>
                        )}
                        {!vacancy.email && vacancy.phone && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                              <Phone className="w-3 h-3" />
                              {vacancy.phone}
                            </span>
                          </>
                        )}
                        {!vacancy.email && !vacancy.phone && vacancy.sourceUrl && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
                              <Link2 className="w-3 h-3" />
                              {t('whatsapp.hasLink')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Button size="sm" onClick={() => void handleImport(vacancy)} disabled={importingId === vacancy.id}>
                      {importingId === vacancy.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Briefcase className="w-3.5 h-3.5" />
                      )}
                      {t('whatsapp.import')}
                    </Button>
                    <button
                      onClick={() => setDeletingId(vacancy.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('whatsapp.delete')}
                    </button>
                  </div>
                </div>

                <p
                  className={`mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line ${
                    !expandedSnippet.has(vacancy.id) ? 'line-clamp-3' : ''
                  }`}
                >
                  {vacancy.snippet}
                </p>

                {vacancy.snippet.length > 180 && (
                  <button
                    onClick={() =>
                      setExpandedSnippet((prev) => {
                        const next = new Set(prev)
                        if (next.has(vacancy.id)) next.delete(vacancy.id)
                        else next.add(vacancy.id)
                        return next
                      })
                    }
                    className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t(expandedSnippet.has(vacancy.id) ? 'whatsapp.showLess' : 'whatsapp.showMore')}
                  </button>
                )}

                {vacancy.ocrText && (
                  <details className="mt-2">
                    <summary className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer">
                      <Image className="w-3 h-3" />
                      {t('whatsapp.showOcr')}
                    </summary>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-line">
                      {vacancy.ocrText}
                    </p>
                  </details>
                )}

                {vacancy.author && (
                  <p className="mt-2 text-[10px] text-gray-400">✎ {vacancy.author}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        title={t('whatsapp.deleteConfirmTitle')}
        message={t('whatsapp.deleteConfirmMessage')}
        variant="danger"
        onConfirm={() => {
          if (deletingId) void handleDelete(deletingId)
        }}
        onCancel={() => setDeletingId(null)}
      />

      <ConfirmDialog
        open={confirmBulk}
        title={t('whatsapp.deleteSelectedConfirmTitle')}
        message={t('whatsapp.deleteSelectedConfirmMessage', { count: selectedIds.size })}
        variant="danger"
        onConfirm={() => void handleDeleteMany()}
        onCancel={() => setConfirmBulk(false)}
      />
    </div>
  )
}
