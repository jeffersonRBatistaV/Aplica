import { useState, useEffect, useMemo } from 'react'
import { Clock, Send, Calendar, Briefcase, XCircle, Eye, MoreHorizontal, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import type { JobApplication, JobStatus } from '../../../shared/types'

interface KanbanBoardProps {
  onSelect: (app: JobApplication) => void
}

export function KanbanBoard({ onSelect }: KanbanBoardProps) {
  const { t } = useTranslation()
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuRect, setMenuRect] = useState<{ top: number; left: number } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const COLUMNS = useMemo(() => [
    { id: 'draft' as JobStatus, label: t('kanban.columnDraft'), icon: Clock, color: 'gray' },
    { id: 'applied' as JobStatus, label: t('kanban.columnApplied'), icon: Send, color: 'blue' },
    { id: 'interview' as JobStatus, label: t('kanban.columnInterview'), icon: Calendar, color: 'amber' },
    { id: 'offer' as JobStatus, label: t('kanban.columnOffer'), icon: Briefcase, color: 'green' },
    { id: 'rejected' as JobStatus, label: t('kanban.columnRejected'), icon: XCircle, color: 'red' },
  ], [t])

  const STATUS_ACTIONS = useMemo(() => [
    { from: 'draft' as JobStatus, to: 'applied' as JobStatus, label: t('kanban.actionMarkApplied') },
    { from: 'applied' as JobStatus, to: 'interview' as JobStatus, label: t('kanban.actionMoveInterview') },
    { from: 'interview' as JobStatus, to: 'offer' as JobStatus, label: t('kanban.actionGotOffer') },
    { from: 'interview' as JobStatus, to: 'rejected' as JobStatus, label: t('kanban.actionRejected') },
    { from: 'applied' as JobStatus, to: 'rejected' as JobStatus, label: t('kanban.actionRejected') },
    { from: 'offer' as JobStatus, to: 'rejected' as JobStatus, label: t('kanban.actionOfferRejected') },
    { from: 'draft' as JobStatus, to: 'rejected' as JobStatus, label: t('kanban.actionDiscard') },
  ], [t])

  const loadJobs = async () => {
    if (!window.api) return
    const all = await window.api.getJobs()
    setJobs(all)
    setLoading(false)
  }

  useEffect(() => {
    loadJobs()
  }, [])

  useEffect(() => {
    const handler = () => loadJobs()
    window.addEventListener('data:imported', handler)
    return () => window.removeEventListener('data:imported', handler)
  }, [])

  const handleMoveStatus = async (id: string, newStatus: JobStatus) => {
    if (!window.api) return
    const job = jobs.find(j => j.id === id)
    if (!job) return
    const updated = { ...job, status: newStatus, updatedAt: Date.now() }
    await window.api.saveJob(updated)
    setJobs(prev => prev.map(j => j.id === id ? updated : j))
    setMenuOpen(null)
    setMenuRect(null)
  }

  const handleDelete = async (id: string) => {
    if (!window.api) return
    await window.api.deleteJob(id)
    setJobs(prev => prev.filter(j => j.id !== id))
    setConfirmDeleteId(null)
    setMenuOpen(null)
    setMenuRect(null)
  }

  const openMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const btn = e.currentTarget as HTMLElement
    const rect = btn.getBoundingClientRect()
    setMenuRect({ top: rect.bottom + 4, left: rect.right - 192 })
    setMenuOpen(menuOpen === id ? null : id)
  }

  const closeMenu = () => {
    setMenuOpen(null)
    setMenuRect(null)
  }

  const menuJob = menuOpen ? jobs.find(j => j.id === menuOpen) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        {t('kanban.loading')}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 min-h-[400px]">
      {COLUMNS.map((col) => {
        const columnJobs = jobs.filter(j => j.status === col.id)
        const Icon = col.icon
        const colColor = {
          gray: 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/30',
          blue: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10',
          amber: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10',
          green: 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10',
          red: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10',
        }
        const headerColor = {
          gray: 'text-gray-600 dark:text-gray-400',
          blue: 'text-blue-600 dark:text-blue-400',
          amber: 'text-amber-600 dark:text-amber-400',
          green: 'text-green-600 dark:text-green-400',
          red: 'text-red-600 dark:text-red-400',
        }
        const badgeColor = {
          gray: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
          blue: 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300',
          amber: 'bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300',
          green: 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300',
          red: 'bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300',
        }

        return (
          <div
            key={col.id}
            className={`rounded-xl border-2 ${colColor[col.color]} flex flex-col`}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-3 border-b border-inherit">
              <Icon className={`w-4 h-4 ${headerColor[col.color]}`} />
              <span className={`text-sm font-semibold ${headerColor[col.color]}`}>{col.label}</span>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ml-auto ${badgeColor[col.color]}`}>
                {columnJobs.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {columnJobs.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-xs text-gray-400 italic">
                  {t('kanban.noApplications')}
                </div>
              ) : (
                columnJobs.map((job) => {
                  const actions = STATUS_ACTIONS.filter(a => a.from === job.status)
                  return (
                    <div
                      key={job.id}
                      className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm hover:shadow-md transition-shadow relative group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {job.position || t('kanban.noPosition')}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {job.company || t('kanban.noCompany')}
                          </p>
                          {job.atsReport && (
                            <span className={`inline-block mt-1 text-xs font-medium px-1.5 py-0.5 rounded ${
                              job.atsReport.matchScore >= 70 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                              job.atsReport.matchScore >= 40 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                              'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            }`}>
                              {job.atsReport.matchScore}% match
                            </span>
                          )}
                        </div>

                        <div>
                          <button
                            onClick={(e) => openMenu(job.id, e)}
                            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}

      {/* Global context menu */}
      {menuOpen && menuJob && menuRect && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeMenu}
          />
          <div
            className="fixed z-50 w-48 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg py-1"
            style={{ top: menuRect.top, left: menuRect.left }}
          >
            <button
              onClick={() => { onSelect(menuJob); closeMenu() }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Eye className="w-3.5 h-3.5" />
              {t('kanban.viewDetail')}
            </button>
            {STATUS_ACTIONS.filter(a => a.from === menuJob.status).map(action => (
              <button
                key={action.to}
                onClick={() => handleMoveStatus(menuJob.id, action.to)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="w-3.5 h-3.5 rounded-full border border-current" />
                {action.label}
              </button>
            ))}
            <hr className="border-gray-200 dark:border-gray-700 my-1" />
            <button
              onClick={() => { setConfirmDeleteId(menuJob.id); closeMenu() }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('kanban.actionDelete')}
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title={t('kanban.confirmDeleteTitle')}
        message={t('kanban.confirmDeleteMessage')}
        confirmLabel={t('confirmDialog.confirm')}
        onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
