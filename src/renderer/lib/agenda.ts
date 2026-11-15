import { useCallback, useEffect, useState } from 'react'
import type { JobApplication, JobStatus } from '../../shared/types'

const DAY = 86_400_000

/** Días sin respuesta tras postular (o tras el último seguimiento) para sugerir un follow-up. */
export const FOLLOW_UP_AFTER_DAYS = 7
/** A partir de aquí la postulación se considera "sin respuesta" y se sugiere cerrarla. */
export const GHOSTED_AFTER_DAYS = 30
/** Ventana de entrevistas que se muestran como próximas. */
const INTERVIEW_WINDOW_DAYS = 14

export const JOBS_CHANGED_EVENT = 'aplica:jobsChanged'
export const OPEN_JOB_EVENT = 'aplica:openJob'
export const VACANTES_TAB_EVENT = 'aplica:vacantesTab'

export function notifyJobsChanged(): void {
  window.dispatchEvent(new Event(JOBS_CHANGED_EVENT))
}

export function daysSince(ts: number | undefined, now = Date.now()): number {
  if (!ts) return 0
  return Math.floor((now - ts) / DAY)
}

/** Fecha de referencia para el seguimiento: último follow-up → fecha de postulación → última edición. */
export function followUpBase(job: JobApplication): number {
  return job.lastFollowUpAt ?? job.appliedAt ?? job.updatedAt ?? job.createdAt
}

export interface Agenda {
  interviews: JobApplication[]
  followUps: JobApplication[]
  readyDrafts: JobApplication[]
  waPending: number
  appliedLast7: number
  counts: Record<JobStatus, number>
  total: number
}

export function buildAgenda(jobs: JobApplication[], waPending: number, now = Date.now()): Agenda {
  const counts: Record<JobStatus, number> = { draft: 0, applied: 0, interview: 0, offer: 0, rejected: 0 }
  for (const j of jobs) counts[j.status] = (counts[j.status] ?? 0) + 1

  const interviews = jobs
    .filter((j) => j.status === 'interview' && j.interviewDate
      && j.interviewDate > now - 2 * 3600_000
      && j.interviewDate < now + INTERVIEW_WINDOW_DAYS * DAY)
    .sort((a, b) => (a.interviewDate ?? 0) - (b.interviewDate ?? 0))

  const followUps = jobs
    .filter((j) => j.status === 'applied' && now - followUpBase(j) >= FOLLOW_UP_AFTER_DAYS * DAY)
    .sort((a, b) => followUpBase(a) - followUpBase(b))

  // Borradores con análisis ATS listos para enviar, priorizando el mejor match.
  const readyDrafts = jobs
    .filter((j) => j.status === 'draft' && j.atsReport)
    .sort((a, b) => (b.atsReport?.matchScore ?? 0) - (a.atsReport?.matchScore ?? 0))

  const appliedLast7 = jobs.filter((j) => j.appliedAt && now - j.appliedAt < 7 * DAY).length

  return { interviews, followUps, readyDrafts, waPending, appliedLast7, counts, total: jobs.length }
}

/**
 * Carga vacantes + cola de WhatsApp y recalcula la agenda. Se refresca al
 * recibir `aplica:jobsChanged`, al volver el foco a la ventana, al detectar
 * vacantes nuevas por WhatsApp y cada minuto (las fechas avanzan solas).
 */
export function useAgenda(refreshKey?: unknown) {
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [agenda, setAgenda] = useState<Agenda>(() => buildAgenda([], 0))
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!window.api) return
    try {
      const [all, queue] = await Promise.all([
        window.api.getJobs().catch(() => [] as JobApplication[]),
        window.api.whatsappGetQueue().catch(() => []),
      ])
      setJobs(all)
      setAgenda(buildAgenda(all, queue.length))
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { void reload() }, [reload, refreshKey])

  useEffect(() => {
    const handler = () => { void reload() }
    window.addEventListener(JOBS_CHANGED_EVENT, handler)
    window.addEventListener('profile:updated', handler)
    window.addEventListener('aplica:whatsappImported', handler)
    window.addEventListener('focus', handler)
    const interval = window.setInterval(handler, 60_000)
    const off = window.api?.onWhatsAppEvent?.((e) => { if (e.type === 'vacancy') handler() })
    return () => {
      window.removeEventListener(JOBS_CHANGED_EVENT, handler)
      window.removeEventListener('profile:updated', handler)
      window.removeEventListener('aplica:whatsappImported', handler)
      window.removeEventListener('focus', handler)
      window.clearInterval(interval)
      off?.()
    }
  }, [reload])

  return { jobs, agenda, loaded, reload }
}
