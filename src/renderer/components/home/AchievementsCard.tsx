import { useMemo } from 'react'
import { Trophy, Flame, Send, MessagesSquare, Award, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { JobApplication } from '../../../shared/types'
import { computeAchievements } from '../../lib/achievements'

/** Logros y racha: refuerzo positivo para mantener el ritmo de búsqueda. */
export function AchievementsCard({ jobs, className = '' }: { jobs: JobApplication[]; className?: string }) {
  const { t } = useTranslation()
  const a = useMemo(() => computeAchievements(jobs), [jobs])
  const unlocked = a.milestones.filter((m) => m.unlocked)

  const stats = [
    { icon: Send, value: a.totalSent, label: t('achievements.sent'), cls: 'text-blue-600 dark:text-blue-400' },
    { icon: MessagesSquare, value: a.interviews, label: t('achievements.interviews'), cls: 'text-amber-600 dark:text-amber-400' },
    { icon: Award, value: a.offers, label: t('achievements.offers'), cls: 'text-green-600 dark:text-green-400' },
    { icon: Flame, value: a.weekStreak, label: t('achievements.streak', { count: a.weekStreak }), cls: 'text-orange-500' },
  ]

  return (
    <section className={`${className} p-4 space-y-4`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          {t('achievements.title')}
        </span>
        <span className="text-xs text-gray-400">{t('achievements.unlocked', { count: unlocked.length, total: a.milestones.length })}</span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">{t(`achievements.mood.${a.mood}`)}</p>

      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <s.icon className={`w-4 h-4 mx-auto ${s.cls}`} />
            <div className={`text-lg font-semibold tabular-nums ${s.cls}`}>{s.value}</div>
            <div className="text-[11px] text-gray-500 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {a.next && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 flex items-center gap-1"><Lock className="w-3 h-3" />{t('achievements.nextLabel')}: <span className="font-medium text-gray-700 dark:text-gray-200">{t(`achievements.milestones.${a.next.key}`)}</span></span>
            <span className="tabular-nums text-gray-400">{Math.min(a.next.value, a.next.target)}/{a.next.target}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${Math.min(100, (a.next.value / a.next.target) * 100)}%` }} />
          </div>
        </div>
      )}

      {unlocked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unlocked.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
              <Trophy className="w-3 h-3" />
              {t(`achievements.milestones.${m.key}`)}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
