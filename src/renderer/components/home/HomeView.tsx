import { useMemo, useState } from 'react'
import {
  Home, CalendarClock, MailCheck, Send, Search, MessageCircle, Sparkles, Plus, Minus,
  Briefcase, ArrowRight, Target, Clock, XCircle, CheckCircle2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppView, JobApplication, JobStatus } from '../../../shared/types'
import { useNavigation } from '../../contexts/AppContext'
import { useSettings } from '../../contexts/SettingsContext'
import {
  useAgenda, daysSince, followUpBase, notifyJobsChanged, OPEN_JOB_EVENT, VACANTES_TAB_EVENT, GHOSTED_AFTER_DAYS,
} from '../../lib/agenda'
import { FollowUpModal } from './FollowUpModal'
import { AchievementsCard } from './AchievementsCard'

const GOAL_KEY = 'aplica:weeklyGoal'
const MAX_ITEMS = 5

function readGoal(): number {
  try {
    const v = Number(localStorage.getItem(GOAL_KEY))
    return Number.isFinite(v) && v > 0 ? v : 5
  } catch {
    return 5
  }
}

export function HomeView() {
  const { t, i18n } = useTranslation()
  const { currentView, setCurrentView } = useNavigation()
  const { profiles, activeProfileId } = useSettings()
  // Recarga al entrar en la vista para reflejar cambios hechos en otras pestañas.
  const { jobs, agenda, loaded } = useAgenda(currentView === 'home')
  const [goal, setGoal] = useState(readGoal)
  const [followUpJob, setFollowUpJob] = useState<JobApplication | null>(null)

  const name = profiles.find((p) => p.id === activeProfileId)?.name?.split(' ')[0] ?? ''
  const today = useMemo(
    () => new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }),
    [i18n.language],
  )

  const changeGoal = (delta: number) => {
    const next = Math.min(50, Math.max(1, goal + delta))
    setGoal(next)
    try { localStorage.setItem(GOAL_KEY, String(next)) } catch { /* noop */ }
  }

  const go = (view: AppView) => setCurrentView(view)

  const openJob = (job: JobApplication) => {
    setCurrentView('jobs')
    window.dispatchEvent(new CustomEvent(OPEN_JOB_EVENT, { detail: job.id }))
  }

  const openVacantesTab = (tab: 'new' | 'board') => {
    setCurrentView('jobs')
    window.dispatchEvent(new CustomEvent(VACANTES_TAB_EVENT, { detail: tab }))
  }

  const closeAsNoResponse = async (job: JobApplication) => {
    if (!window.api) return
    const fresh = (await window.api.getJob(job.id)) ?? job
    await window.api.saveJob({ ...fresh, status: 'rejected', updatedAt: Date.now() })
    notifyJobsChanged()
  }

  const progress = Math.min(100, Math.round((agenda.appliedLast7 / goal) * 100))
  const pendingTotal = agenda.interviews.length + agenda.followUps.length
  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const pipeline: { id: JobStatus; label: string; cls: string }[] = [
    { id: 'draft', label: t('kanban.columnDraft'), cls: 'text-gray-600 dark:text-gray-300' },
    { id: 'applied', label: t('kanban.columnApplied'), cls: 'text-blue-600 dark:text-blue-400' },
    { id: 'interview', label: t('kanban.columnInterview'), cls: 'text-amber-600 dark:text-amber-400' },
    { id: 'offer', label: t('kanban.columnOffer'), cls: 'text-green-600 dark:text-green-400' },
    { id: 'rejected', label: t('kanban.columnRejected'), cls: 'text-red-500 dark:text-red-400' },
  ]

  const card = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60'
  const rowBtn = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors'

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 first-letter:uppercase">{today}</p>
            <h2 className="text-2xl font-semibold flex items-center gap-2 mt-1">
              <Home className="w-5 h-5 text-blue-500" />
              {name ? t('home.greetingName', { name }) : t('home.greeting')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {!loaded ? t('home.loading')
                : pendingTotal > 0 ? t('home.pendingSummary', { count: pendingTotal })
                : t('home.allClear')}
            </p>
          </div>

          {/* Weekly goal */}
          <div className={`${card} px-4 py-3 min-w-[240px]`}>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />{t('home.weeklyGoal')}</span>
              <span className="flex items-center gap-1">
                <button onClick={() => changeGoal(-1)} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="-1"><Minus className="w-3 h-3" /></button>
                <button onClick={() => changeGoal(1)} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="+1"><Plus className="w-3 h-3" /></button>
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums">{agenda.appliedLast7}</span>
              <span className="text-sm text-gray-400">/ {goal} {t('home.applications')}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">{t('home.last7Days')}</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Plus, label: t('home.actions.newVacancy'), hint: t('home.actions.newVacancyHint'), onClick: () => openVacantesTab('new') },
            { icon: Search, label: t('home.actions.searchJobs'), hint: t('home.actions.searchJobsHint'), onClick: () => go('browser') },
            { icon: MessageCircle, label: t('home.actions.whatsapp'), hint: agenda.waPending > 0 ? t('home.actions.whatsappPending', { count: agenda.waPending }) : t('home.actions.whatsappHint'), onClick: () => go('whatsapp'), badge: agenda.waPending },
            { icon: Sparkles, label: t('home.actions.askAi'), hint: t('home.actions.askAiHint'), onClick: () => go('chat') },
          ].map((a) => (
            <button key={a.label} onClick={a.onClick} className={`${card} relative p-4 text-left hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all`}>
              <a.icon className="w-5 h-5 text-blue-500 mb-2" />
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.hint}</p>
              {!!a.badge && (
                <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 rounded-full bg-green-500 text-white text-[11px] font-semibold flex items-center justify-center">{a.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Logros y racha */}
        {loaded && <AchievementsCard jobs={jobs} className={card} />}

        {/* Pipeline */}
        <button onClick={() => openVacantesTab('board')} className={`${card} w-full p-4 text-left hover:border-blue-300 dark:hover:border-blue-700 transition-colors`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4 text-gray-400" />{t('home.pipeline')}</span>
            <span className="text-xs text-blue-500 flex items-center gap-1">{t('home.openBoard')}<ArrowRight className="w-3 h-3" /></span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {pipeline.map((p) => (
              <div key={p.id} className="text-center">
                <div className={`text-xl font-semibold tabular-nums ${p.cls}`}>{agenda.counts[p.id]}</div>
                <div className="text-[11px] text-gray-500 truncate">{p.label}</div>
              </div>
            ))}
          </div>
        </button>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming interviews */}
          <section className={`${card} p-4`}>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <CalendarClock className="w-4 h-4 text-amber-500" />
              {t('home.interviews')}
              {agenda.interviews.length > 0 && <span className="text-xs font-normal text-gray-400">({agenda.interviews.length})</span>}
            </h3>
            {agenda.interviews.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">{t('home.noInterviews')}</p>
            ) : (
              <div className="space-y-0.5">
                {agenda.interviews.slice(0, MAX_ITEMS).map((j) => {
                  const hours = Math.round(((j.interviewDate ?? 0) - Date.now()) / 3600_000)
                  const soon = hours <= 24
                  return (
                    <button key={j.id} onClick={() => openJob(j)} className={rowBtn}>
                      <div className={`w-1 self-stretch rounded-full ${soon ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{j.position || t('home.untitled')}</p>
                        <p className="text-xs text-gray-500 truncate">{j.company} · {fmtDate(j.interviewDate ?? 0)}</p>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${soon ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                        {hours <= 0 ? t('home.now') : hours < 24 ? t('home.inHours', { count: hours }) : t('home.inDays', { count: Math.round(hours / 24) })}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {agenda.interviews.length > 0 && <p className="text-[11px] text-gray-400 mt-2 px-1">{t('home.interviewsHint')}</p>}
          </section>

          {/* Follow-ups */}
          <section className={`${card} p-4`}>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <MailCheck className="w-4 h-4 text-blue-500" />
              {t('home.followUps')}
              {agenda.followUps.length > 0 && <span className="text-xs font-normal text-gray-400">({agenda.followUps.length})</span>}
            </h3>
            {agenda.followUps.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">{t('home.noFollowUps')}</p>
            ) : (
              <div className="space-y-0.5">
                {agenda.followUps.slice(0, MAX_ITEMS).map((j) => {
                  const days = daysSince(followUpBase(j))
                  const ghosted = daysSince(j.appliedAt ?? j.createdAt) >= GHOSTED_AFTER_DAYS
                  return (
                    <div key={j.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/70">
                      <button onClick={() => openJob(j)} className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium truncate">{j.position || t('home.untitled')}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {j.company} · {j.lastFollowUpAt ? t('home.daysSinceFollowUp', { count: days }) : t('home.daysSinceApplied', { count: days })}
                        </p>
                      </button>
                      {ghosted && (
                        <button onClick={() => closeAsNoResponse(j)} title={t('home.closeNoResponse')} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => setFollowUpJob(j)} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50">
                        <Send className="w-3 h-3" />
                        {t('home.followUpAction')}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {agenda.followUps.length > MAX_ITEMS && (
              <p className="text-[11px] text-gray-400 mt-2 px-1">{t('home.andMore', { count: agenda.followUps.length - MAX_ITEMS })}</p>
            )}
          </section>
        </div>

        {/* Ready drafts */}
        <section className={`${card} p-4`}>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-gray-400" />
            {t('home.readyDrafts')}
            {agenda.readyDrafts.length > 0 && <span className="text-xs font-normal text-gray-400">({agenda.readyDrafts.length})</span>}
          </h3>
          {agenda.readyDrafts.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-gray-400">{agenda.total === 0 ? t('home.noJobsYet') : t('home.noDrafts')}</p>
              {agenda.total === 0 && (
                <button onClick={() => openVacantesTab('new')} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  <Plus className="w-3 h-3" />{t('home.actions.newVacancy')}
                </button>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-1">
              {agenda.readyDrafts.slice(0, 6).map((j) => {
                const score = j.atsReport?.matchScore ?? 0
                const scoreCls = score >= 75 ? 'text-green-600 dark:text-green-400' : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'
                return (
                  <button key={j.id} onClick={() => openJob(j)} className={rowBtn}>
                    <span className={`text-sm font-semibold tabular-nums w-10 shrink-0 ${scoreCls}`}>{score}%</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{j.position || t('home.untitled')}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {j.company}{j.cvContent ? ` · ${t('home.cvReady')}` : ''}
                      </p>
                    </div>
                    {j.cvContent ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {followUpJob && <FollowUpModal job={followUpJob} onClose={() => setFollowUpJob(null)} />}
    </div>
  )
}
