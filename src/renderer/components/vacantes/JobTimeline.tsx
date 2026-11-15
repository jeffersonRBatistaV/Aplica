import { useEffect, useState } from 'react'
import { History, StickyNote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { JobApplication, JobStatus } from '../../../shared/types'

interface JobTimelineProps {
  job: JobApplication
  onNotesChange: (notes: string) => void
}

const DOT: Record<JobStatus, string> = {
  draft: 'bg-gray-400',
  applied: 'bg-blue-500',
  interview: 'bg-amber-500',
  offer: 'bg-green-500',
  rejected: 'bg-red-500',
}

const LABEL_KEY: Record<JobStatus, string> = {
  draft: 'kanban.columnDraft',
  applied: 'kanban.columnApplied',
  interview: 'kanban.columnInterview',
  offer: 'kanban.columnOffer',
  rejected: 'kanban.columnRejected',
}

/** Historial de estados + seguimientos + notas privadas de la postulación. */
export function JobTimeline({ job, onNotesChange }: JobTimelineProps) {
  const { t, i18n } = useTranslation()
  const [notes, setNotes] = useState(job.notes ?? '')

  useEffect(() => { setNotes(job.notes ?? '') }, [job.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (ts: number) => new Date(ts).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })

  const events: { key: string; dot: string; label: string; at: number }[] = [
    { key: 'created', dot: 'bg-gray-300 dark:bg-gray-600', label: t('timeline.created'), at: job.createdAt },
    ...(job.statusHistory ?? [])
      .filter((h, i) => !(i === 0 && h.status === 'draft'))
      .map((h, i) => ({ key: `s${i}`, dot: DOT[h.status], label: t(LABEL_KEY[h.status]), at: h.at })),
    ...(job.lastFollowUpAt ? [{ key: 'fu', dot: 'bg-indigo-500', label: t('timeline.followUp'), at: job.lastFollowUpAt }] : []),
  ].sort((a, b) => a.at - b.at)

  // Vacantes antiguas sin historial: al menos mostrar el estado actual.
  if (!job.statusHistory?.length && job.status !== 'draft') {
    events.push({ key: 'current', dot: DOT[job.status], label: t(LABEL_KEY[job.status]), at: job.appliedAt ?? job.updatedAt })
  }

  return (
    <div className="grid md:grid-cols-2 gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          {t('timeline.title')}
        </h4>
        <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-1.5 space-y-2">
          {events.map((e) => (
            <li key={e.key} className="pl-3 relative">
              <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-gray-50 dark:ring-gray-800 ${e.dot}`} />
              <span className="text-sm">{e.label}</span>
              <span className="text-xs text-gray-400 ml-2">{fmt(e.at)}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col">
        <label htmlFor={`notes-${job.id}`} className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5" />
          {t('timeline.notes')}
        </label>
        <textarea
          id={`notes-${job.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if (notes !== (job.notes ?? '')) onNotesChange(notes) }}
          placeholder={t('timeline.notesPlaceholder')}
          rows={4}
          className="flex-1 w-full px-2.5 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
        />
      </div>
    </div>
  )
}
