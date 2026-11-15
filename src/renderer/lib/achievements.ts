import type { JobApplication } from '../../shared/types'

const DAY = 86_400_000
const WEEK = 7 * DAY

export interface Milestone {
  id: string
  /** Clave i18n en `achievements.milestones.*`. */
  key: string
  target: number
  value: number
  unlocked: boolean
}

export interface Achievements {
  totalSent: number
  interviews: number
  offers: number
  /** Semanas seguidas (incluida la actual o la anterior) con al menos una postulación. */
  weekStreak: number
  milestones: Milestone[]
  next: Milestone | null
  /** Tipo de mensaje de ánimo a mostrar. */
  mood: 'start' | 'keepGoing' | 'momentum' | 'interviews' | 'offer'
}

function reached(job: JobApplication, status: 'interview' | 'offer'): boolean {
  if (job.status === status) return true
  if (status === 'interview' && job.status === 'offer') return true
  return !!job.statusHistory?.some((h) => h.status === status || (status === 'interview' && h.status === 'offer'))
}

/** Inicio (lunes 00:00) de la semana que contiene `ts`. */
function weekStart(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7
  return d.getTime() - day * DAY
}

function computeWeekStreak(sentAt: number[], now: number): number {
  if (sentAt.length === 0) return 0
  const weeks = new Set(sentAt.map(weekStart))
  let cursor = weekStart(now)
  // Si esta semana todavía no hay postulaciones, la racha sigue viva desde la semana pasada.
  if (!weeks.has(cursor)) cursor -= WEEK
  let streak = 0
  while (weeks.has(cursor)) {
    streak++
    cursor -= WEEK
  }
  return streak
}

export function computeAchievements(jobs: JobApplication[], now = Date.now()): Achievements {
  const sent = jobs.filter((j) => j.status !== 'draft' || j.appliedAt)
  const totalSent = sent.length
  const interviews = jobs.filter((j) => reached(j, 'interview')).length
  const offers = jobs.filter((j) => reached(j, 'offer')).length
  const weekStreak = computeWeekStreak(sent.map((j) => j.appliedAt ?? j.updatedAt ?? j.createdAt), now)

  const defs: { id: string; key: string; target: number; value: number }[] = [
    { id: 'first', key: 'firstApplication', target: 1, value: totalSent },
    { id: 'five', key: 'fiveApplications', target: 5, value: totalSent },
    { id: 'ten', key: 'tenApplications', target: 10, value: totalSent },
    { id: 'twentyFive', key: 'twentyFiveApplications', target: 25, value: totalSent },
    { id: 'fifty', key: 'fiftyApplications', target: 50, value: totalSent },
    { id: 'interview', key: 'firstInterview', target: 1, value: interviews },
    { id: 'threeInterviews', key: 'threeInterviews', target: 3, value: interviews },
    { id: 'offer', key: 'firstOffer', target: 1, value: offers },
    { id: 'streak', key: 'threeWeekStreak', target: 3, value: weekStreak },
  ]
  const milestones = defs.map((d) => ({ ...d, unlocked: d.value >= d.target }))
  // Siguiente logro: el que esté más cerca de completarse.
  const pending = milestones.filter((m) => !m.unlocked)
  const next = pending.sort((a, b) => b.value / b.target - a.value / a.target)[0] ?? null

  const mood: Achievements['mood'] =
    offers > 0 ? 'offer'
      : interviews > 0 ? 'interviews'
        : weekStreak >= 2 ? 'momentum'
          : totalSent > 0 ? 'keepGoing'
            : 'start'

  return { totalSent, interviews, offers, weekStreak, milestones, next, mood }
}
