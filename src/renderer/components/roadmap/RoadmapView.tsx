import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Map, RefreshCw, Loader2, Clock, AlertTriangle, CheckCircle2, Circle, Compass, Flag, MapPin,
  ChevronDown, ChevronRight, Pencil, Target, Package, Trophy,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Roadmap, RoadmapPhase, RoadmapGoal, Profile } from '../../../shared/types'
import { friendlyMessage } from '../../lib/friendly-error'

const PRIORITY_COLORS: Record<string, string> = {
  alta: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  media: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  baja: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
}

const HORIZONS = [3, 6, 9, 12, 18, 24]
const WORK_MODES: NonNullable<RoadmapGoal['workMode']>[] = ['cualquiera', 'remoto', 'hibrido', 'presencial']

type GoalDraft = Omit<RoadmapGoal, 'updatedAt'>

const inputClass =
  'w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40'

function GoalForm({
  initial,
  profile,
  saving,
  onSubmit,
  onCancel,
}: {
  initial: RoadmapGoal | null
  profile: Profile | null
  saving: boolean
  onSubmit: (goal: GoalDraft) => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<GoalDraft>(() => ({
    targetRole: initial?.targetRole ?? '',
    horizonMonths: initial?.horizonMonths ?? 6,
    why: initial?.why ?? '',
    targetMarket: initial?.targetMarket ?? profile?.targetMarket ?? '',
    workMode: initial?.workMode ?? 'cualquiera',
    targetSalary: initial?.targetSalary ?? '',
    hoursPerWeek: initial?.hoursPerWeek ?? 10,
    constraints: initial?.constraints ?? '',
  }))
  const set = <K extends keyof GoalDraft>(key: K, value: GoalDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const valid = draft.targetRole.trim().length >= 3

  return (
    <div className="max-w-2xl mx-auto rounded-2xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex items-start gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30">
          <Compass className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('roadmapView.goalTitle')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('roadmapView.goalSubtitle')}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('roadmapView.targetRole')} *</label>
          <input
            className={inputClass}
            value={draft.targetRole}
            onChange={(e) => set('targetRole', e.target.value)}
            placeholder={t('roadmapView.targetRolePlaceholder', { title: profile?.title || 'Desarrollador' })}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('roadmapView.why')}</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={2}
            value={draft.why}
            onChange={(e) => set('why', e.target.value)}
            placeholder={t('roadmapView.whyPlaceholder')}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('roadmapView.horizon')}</label>
            <select className={inputClass} value={draft.horizonMonths} onChange={(e) => set('horizonMonths', Number(e.target.value))}>
              {HORIZONS.map((m) => (
                <option key={m} value={m}>{t('roadmapView.months', { count: m })}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('roadmapView.hoursPerWeek')}</label>
            <input
              type="number"
              min={1}
              max={80}
              className={inputClass}
              value={draft.hoursPerWeek ?? ''}
              onChange={(e) => set('hoursPerWeek', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('roadmapView.market')}</label>
            <input className={inputClass} value={draft.targetMarket ?? ''} onChange={(e) => set('targetMarket', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('roadmapView.workMode')}</label>
            <select className={inputClass} value={draft.workMode} onChange={(e) => set('workMode', e.target.value as GoalDraft['workMode'])}>
              {WORK_MODES.map((m) => (
                <option key={m} value={m}>{t(`roadmapView.workModes.${m}`)}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('roadmapView.salary')}</label>
            <input
              className={inputClass}
              value={draft.targetSalary ?? ''}
              onChange={(e) => set('targetSalary', e.target.value)}
              placeholder={t('roadmapView.salaryPlaceholder')}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('roadmapView.constraints')}</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={draft.constraints ?? ''}
              onChange={(e) => set('constraints', e.target.value)}
              placeholder={t('roadmapView.constraintsPlaceholder')}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
        {onCancel && (
          <button onClick={onCancel} disabled={saving} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            {t('roadmapView.cancel')}
          </button>
        )}
        <button
          onClick={() => onSubmit({ ...draft, targetRole: draft.targetRole.trim() })}
          disabled={!valid || saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Map className="w-4 h-4" />}
          {t('roadmapView.drawRoute')}
        </button>
      </div>
    </div>
  )
}

type MilestoneState = 'done' | 'current' | 'upcoming'

function MilestoneNode({
  phase,
  index,
  state,
  onToggle,
}: {
  phase: RoadmapPhase
  index: number
  state: MilestoneState
  onToggle: (stepId: string, done: boolean) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(state === 'current')
  useEffect(() => { if (state === 'current') setOpen(true) }, [state])
  const done = phase.actions.filter((a) => a.done).length

  const dot =
    state === 'done'
      ? 'bg-emerald-500 text-white'
      : state === 'current'
        ? 'bg-blue-600 text-white ring-4 ring-blue-200 dark:ring-blue-900/60'
        : 'bg-white dark:bg-gray-900 text-gray-400 border-2 border-gray-300 dark:border-gray-600'
  const card =
    state === 'current'
      ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20'
      : state === 'done'
        ? 'border-emerald-200 dark:border-emerald-900 bg-white dark:bg-gray-900/50'
        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50'

  return (
    <li className="relative pl-12">
      <div className={`absolute left-0 top-1 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${dot}`}>
        {state === 'done' ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
      </div>
      <div className={`rounded-xl border ${card} transition-colors`}>
        <button className="w-full flex items-start gap-2 p-4 text-left" onClick={() => setOpen((o) => !o)}>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{phase.name}</h3>
              {state === 'current' && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-600 text-white">{t('roadmapView.youAreHere')}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              {phase.timeframe && (
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{phase.timeframe}</span>
              )}
              <span>{t('roadmapView.stepsDone', { done, total: phase.actions.length })}</span>
            </div>
            {phase.objective && (
              <p className="flex items-start gap-1.5 mt-2 text-xs text-gray-700 dark:text-gray-300">
                <Target className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
                <span>{phase.objective}</span>
              </p>
            )}
          </div>
          {open ? <ChevronDown className="w-4 h-4 text-gray-400 mt-1" /> : <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />}
        </button>
        {open && (
          <div className="px-4 pb-4 space-y-2">
            {phase.actions.map((action) => (
              <label
                key={action.id}
                className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  action.done
                    ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={!!action.done}
                  onChange={(e) => action.id && onToggle(action.id, e.target.checked)}
                />
                <div className="shrink-0 mt-0.5">
                  {action.done
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`text-sm font-medium ${action.done ? 'text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200'}`}>{action.title}</h4>
                    <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${PRIORITY_COLORS[action.priority] || PRIORITY_COLORS.media}`}>
                      {t(`roadmapView.priority.${action.priority}`, { defaultValue: action.priority })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{action.description}</p>
                  {action.deliverable && (
                    <p className="flex items-start gap-1 mt-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                      <Package className="w-3 h-3 mt-0.5 shrink-0 text-violet-500" />
                      <span><span className="font-medium">{t('roadmapView.deliverable')}:</span> {action.deliverable}</span>
                    </p>
                  )}
                </div>
              </label>
            ))}
            {phase.successCriteria && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
                <Trophy className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span><span className="font-semibold">{t('roadmapView.successCriteria')}</span> {phase.successCriteria}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export function RoadmapView() {
  const { t, i18n } = useTranslation()
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [goal, setGoal] = useState<RoadmapGoal | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingGoal, setSavingGoal] = useState(false)
  const [editingGoal, setEditingGoal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!window.api) return
    setLoading(true)
    try {
      const [cached, savedGoal, prof] = await Promise.all([
        window.api.getRoadmap(),
        window.api.getRoadmapGoal(),
        window.api.getProfile(),
      ])
      setRoadmap(cached)
      setGoal(savedGoal)
      setProfile(prof)
    } catch {
      setError(t('roadmapView.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const handler = () => {
      setError(null)
      setEditingGoal(false)
      void load()
    }
    window.addEventListener('profile:updated', handler)
    return () => window.removeEventListener('profile:updated', handler)
  }, [load])

  const regenerate = async () => {
    if (!window.api) return
    setRefreshing(true)
    setError(null)
    const unsub = window.api.onInvestigatePhase((p) => setPhase(p.message))
    try {
      const fresh = await window.api.refreshRoadmap()
      if (fresh) setRoadmap(fresh)
      else setError(t('roadmapView.generateError'))
    } catch (err) {
      setError(err instanceof Error ? friendlyMessage(err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : t('roadmapView.generateError'))
    } finally {
      unsub()
      setPhase(null)
      setRefreshing(false)
    }
  }

  const submitGoal = async (draft: GoalDraft) => {
    if (!window.api) return
    setSavingGoal(true)
    try {
      const saved = await window.api.saveRoadmapGoal(draft)
      setGoal(saved)
      setEditingGoal(false)
    } catch {
      setError(t('roadmapView.goalSaveError'))
      return
    } finally {
      setSavingGoal(false)
    }
    await regenerate()
  }

  const toggleStep = async (stepId: string, done: boolean) => {
    // Optimista: se refleja al instante y se persiste en segundo plano.
    setRoadmap((prev) => prev && {
      ...prev,
      phases: prev.phases.map((p) => ({
        ...p,
        actions: p.actions.map((a) => (a.id === stepId ? { ...a, done } : a)),
      })),
    })
    try {
      const saved = await window.api.toggleRoadmapStep(stepId, done)
      if (saved) setRoadmap(saved)
    } catch { /* se mantiene el estado local */ }
  }

  const stats = useMemo(() => {
    const all = roadmap?.phases.flatMap((p) => p.actions) ?? []
    const done = all.filter((a) => a.done).length
    const states: MilestoneState[] = []
    let currentFound = false
    for (const p of roadmap?.phases ?? []) {
      const complete = p.actions.length > 0 && p.actions.every((a) => a.done)
      if (complete) states.push('done')
      else if (!currentFound) { states.push('current'); currentFound = true }
      else states.push('upcoming')
    }
    return { total: all.length, done, pct: all.length ? Math.round((done / all.length) * 100) : 0, states, finished: !currentFound && all.length > 0 }
  }, [roadmap])

  const goalChanged = !!(goal && roadmap && goal.updatedAt > roadmap.generatedAt)
  const north = goal?.targetRole || roadmap?.goal?.targetRole || roadmap?.northStar || ''

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('roadmapView.loading')}
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Map className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('roadmapView.noProfile')}</p>
        </div>
      </div>
    )
  }

  const showGoalForm = editingGoal || !goal

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Map className="w-5 h-5 text-blue-500" />
          {t('roadmapView.title')}
        </h2>
        {goal && !showGoalForm && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditingGoal(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t('roadmapView.editGoal')}
            </button>
            <button
              onClick={() => void regenerate()}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? t('roadmapView.regenerating') : t('roadmapView.regenerate')}
            </button>
          </div>
        )}
      </div>

      {phase && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            <span>{phase}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {showGoalForm && (
        <GoalForm
          initial={goal}
          profile={profile}
          saving={savingGoal || refreshing}
          onSubmit={(g) => void submitGoal(g)}
          onCancel={goal ? () => setEditingGoal(false) : undefined}
        />
      )}

      {!showGoalForm && !roadmap && !refreshing && (
        <div className="text-center py-12 space-y-3">
          <Compass className="w-12 h-12 text-blue-400 mx-auto" />
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('roadmapView.readyToDraw', { goal: goal?.targetRole })}</p>
          <button
            onClick={() => void regenerate()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            <Map className="w-4 h-4" />
            {t('roadmapView.drawRoute')}
          </button>
        </div>
      )}

      {!showGoalForm && roadmap && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Brújula: el norte y el progreso */}
          <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-gray-900 p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-600 text-white"><Compass className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{t('roadmapView.yourNorth')}</p>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{north}</h3>
                {roadmap.northStar && roadmap.northStar !== north && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{roadmap.northStar}</p>
                )}
                {goal?.why && <p className="text-xs italic text-gray-500 dark:text-gray-400 mt-1">“{goal.why}”</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                  {goal?.horizonMonths && <span>{t('roadmapView.months', { count: goal.horizonMonths })}</span>}
                  <span>{roadmap.targetMarket}</span>
                  {goal?.workMode && goal.workMode !== 'cualquiera' && <span>{t(`roadmapView.workModes.${goal.workMode}`)}</span>}
                  {goal?.targetSalary && <span>{goal.targetSalary}</span>}
                  <span>{t('roadmapView.generatedOn', { date: new Date(roadmap.generatedAt).toLocaleDateString(i18n.language) })}</span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                <span>{t('roadmapView.progress', { done: stats.done, total: stats.total })}</span>
                <span className="font-semibold">{stats.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all" style={{ width: `${stats.pct}%` }} />
              </div>
            </div>
          </div>

          {goalChanged && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
              <span>{t('roadmapView.goalChanged')}</span>
              <button onClick={() => void regenerate()} disabled={refreshing} className="shrink-0 font-semibold hover:underline">
                {t('roadmapView.regenerate')}
              </button>
            </div>
          )}

          {/* Brechas */}
          {roadmap.gaps && roadmap.gaps.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('roadmapView.gaps')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {roadmap.gaps.map((g, i) => (
                  <div key={i} className="text-xs rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{g.skill}</span>
                    <div className="text-gray-500 dark:text-gray-400 mt-0.5">
                      {g.current || '—'} <span className="mx-1">→</span> <span className="text-blue-600 dark:text-blue-400">{g.needed}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* El camino */}
          <ol className="relative space-y-5 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-gray-300 before:via-blue-300 before:to-emerald-400 dark:before:from-gray-700 dark:before:via-blue-800 dark:before:to-emerald-700">
            <li className="relative pl-12">
              <div className="absolute left-0 top-0 w-9 h-9 rounded-full flex items-center justify-center bg-gray-700 dark:bg-gray-600 text-white">
                <MapPin className="w-4 h-4" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 pt-0.5">{t('roadmapView.today')}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{roadmap.startingPoint || profile.title}</p>
            </li>

            {roadmap.phases.map((p, i) => (
              <MilestoneNode key={`${roadmap.generatedAt}-${i}`} phase={p} index={i} state={stats.states[i] ?? 'upcoming'} onToggle={(id, d) => void toggleStep(id, d)} />
            ))}

            <li className="relative pl-12">
              <div className={`absolute left-0 top-0 w-9 h-9 rounded-full flex items-center justify-center text-white ${stats.finished ? 'bg-emerald-500' : 'bg-emerald-600/70'}`}>
                <Flag className="w-4 h-4" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 pt-0.5">{t('roadmapView.destination')}</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{north}</p>
              {stats.finished && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{t('roadmapView.finished')}</p>}
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}
