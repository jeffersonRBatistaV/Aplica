import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Briefcase,
  TrendingUp,
  Target,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Lightbulb,
  Loader2,
  Map,
  ArrowRight,
} from 'lucide-react'
import type { Conversation, JobApplication, JobStatus } from '../../../shared/types'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '../../contexts/AppContext'

interface Stats {
  totalConversations: number
  totalMessages: number
  totalJobs: number
  jobsByStatus: Record<JobStatus, number>
  avgMatchScore: number
  interviews: number
  offers: number
  matchScores: { company: string; position: string; score: number }[]
}

const STATUS_KEYS: JobStatus[] = ['draft', 'applied', 'interview', 'offer', 'rejected']

const STATUS_COLORS: Record<JobStatus, string> = {
  draft: '#9ca3af',
  applied: '#3b82f6',
  interview: '#eab308',
  offer: '#22c55e',
  rejected: '#ef4444',
}

const STATUS_COLORS_BG: Record<JobStatus, string> = {
  draft: 'bg-gray-400',
  applied: 'bg-blue-500',
  interview: 'bg-yellow-500',
  offer: 'bg-green-500',
  rejected: 'bg-red-500',
}

const STATUS_CHART_COLORS: Record<JobStatus, string> = {
  draft: '#9ca3af',
  applied: '#3b82f6',
  interview: '#eab308',
  offer: '#22c55e',
  rejected: '#ef4444',
}

function PieChart({ data, size = 160 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-xs" style={{ width: size, height: size }}>
        Sin datos
      </div>
    )
  }
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 8
  let accumulated = 0
  const slices = data.map((d) => {
    const startAngle = (accumulated / total) * 360
    accumulated += d.value
    const endAngle = (accumulated / total) * 360
    const startRad = ((startAngle - 90) * Math.PI) / 180
    const endRad = ((endAngle - 90) * Math.PI) / 180
    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return {
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: d.color,
      label: d.label,
      value: d.value,
      pct: Math.round((d.value / total) * 100),
    }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => (
        <g key={i}>
          <path d={s.path} fill={s.color} stroke="white" strokeWidth={1.5} />
          <title>{s.label}: {s.value} ({s.pct}%)</title>
        </g>
      ))}
      <circle cx={cx} cy={cy} r={r * 0.45} fill="white" className="dark:fill-gray-900" />
      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100 text-xs font-bold" fontSize="11">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" className="fill-gray-400" fontSize="8">
        total
      </text>
    </svg>
  )
}

function BarChart({ data, height = 160 }: { data: { label: string; value: number; color: string }[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const n = data.length
  const barGap = 8
  const barW = Math.max(20, Math.min(48, (100 - barGap * (n - 1)) / n / 2 * 100))
  const vbW = (barW + barGap) * n + barGap
  const scale = 100 / vbW
  return (
    <svg viewBox={`0 0 ${vbW} ${height}`} className="w-full" style={{ maxHeight: height, height: 'auto' }} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barH = (d.value / max) * (height - 30)
        const x = barGap + i * (barW + barGap)
        const y = height - 20 - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, 1)} rx={3} fill={d.color} />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill="currentColor" className="text-[--text-color]" fontSize="9" fontWeight="600">
              {d.value}
            </text>
            <text x={x + barW / 2} y={height - 4} textAnchor="middle" fill="#9ca3af" fontSize="7">
              {d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function Analytics() {
  const { t } = useTranslation()
  const { setCurrentView } = useNavigation()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [advice, setAdvice] = useState<{ diagnostico: string; areaMejora: string; planAccion: string } | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [conversations, jobs, cachedAdvice] = await Promise.all([
          window.api.getConversations(),
          window.api.getJobs(),
          window.api.getCareerAdvice(),
        ])
        computeStats(conversations, jobs)
        if (cachedAdvice) {
          setAdvice(cachedAdvice)
          setAdviceLoading(false)
        } else {
          const fresh = await window.api.refreshCareerAdvice()
          setAdvice(fresh)
          setAdviceLoading(false)
        }
      } catch (e) {
        console.error('Failed to load analytics data', e)
        setAdviceLoading(false)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const handler = async () => {
      try {
        const [conversations, jobs] = await Promise.all([
          window.api.getConversations(),
          window.api.getJobs(),
        ])
        computeStats(conversations, jobs)
      } catch (e) {
        console.error('Failed to refresh analytics data', e)
      }
    }
    window.addEventListener('data:imported', handler)
    return () => window.removeEventListener('data:imported', handler)
  }, [])

  function computeStats(conversations: Conversation[], jobs: JobApplication[]) {
    const totalConversations = conversations.length
    const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0)

    const jobsByStatus: Record<JobStatus, number> = {
      draft: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
    }
    let totalScore = 0
    let scoreCount = 0
    let interviews = 0
    let offers = 0
    const matchScores: { company: string; position: string; score: number }[] = []

    for (const job of jobs) {
      jobsByStatus[job.status] = (jobsByStatus[job.status] || 0) + 1
      if (job.atsReport?.matchScore != null) {
        totalScore += job.atsReport.matchScore
        scoreCount++
        matchScores.push({ company: job.company || '?', position: job.position || '?', score: job.atsReport.matchScore })
      }
      if (job.status === 'interview') interviews++
      if (job.status === 'offer') offers++
    }

    matchScores.sort((a, b) => b.score - a.score)

    setStats({
      totalConversations,
      totalMessages,
      totalJobs: jobs.length,
      jobsByStatus,
      avgMatchScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
      interviews,
      offers,
      matchScores,
    })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-gray-400">{t('analytics.loading')}</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-gray-400">{t('analytics.loadError')}</div>
      </div>
    )
  }

  const STATUS_LABELS = (s: JobStatus) => t(`analytics.status${s.charAt(0).toUpperCase() + s.slice(1)}`)

  const pieData = STATUS_KEYS.map((status) => ({
    label: STATUS_LABELS(status),
    value: stats.jobsByStatus[status] || 0,
    color: STATUS_CHART_COLORS[status],
  })).filter(d => d.value > 0)

  const barData = STATUS_KEYS.map((status) => ({
    label: STATUS_LABELS(status),
    value: stats.jobsByStatus[status] || 0,
    color: STATUS_CHART_COLORS[status],
  }))

  const matchBarData = stats.matchScores.slice(0, 8).map(m => ({
    label: m.position.split(' ').slice(0, 2).join(' '),
    value: m.score,
    color: m.score >= 70 ? '#22c55e' : m.score >= 40 ? '#eab308' : '#ef4444',
  }))

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-blue-500" />
        {t('analytics.title')}
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1">
          <div className="flex items-center gap-2 text-gray-400">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">{t('analytics.conversations')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalConversations}</p>
          <p className="text-xs text-gray-400">{t('analytics.totalMessages', { count: stats.totalMessages })}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1">
          <div className="flex items-center gap-2 text-gray-400">
            <Briefcase className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">{t('analytics.applications')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalJobs}</p>
          <p className="text-xs text-gray-400">{t('analytics.interviewsOffers', { interviews: stats.interviews, offers: stats.offers })}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1">
          <div className="flex items-center gap-2 text-gray-400">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">{t('analytics.avgMatch')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.avgMatchScore}%
          </p>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${stats.avgMatchScore}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1">
          <div className="flex items-center gap-2 text-gray-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">{t('analytics.successRate')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalJobs > 0 ? Math.round((stats.offers / stats.totalJobs) * 100) : 0}%
          </p>
          <p className="text-xs text-gray-400">{t('analytics.offersOfApplications', { offers: stats.offers, total: stats.totalJobs })}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            {t('analytics.distributionByStatus')}
          </h3>
          <div className="flex items-center gap-6">
            <PieChart data={pieData} />
            <div className="space-y-1.5">
              {pieData.map((d) => (
                <div key={d.label} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600 dark:text-gray-400">{d.label}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{d.value}</span>
                  <span className="text-gray-400">({d.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vertical bar chart - Match scores */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-400" />
            {t('analytics.matchScoresByJob')}
          </h3>
          {matchBarData.length > 0 ? (
            <BarChart data={matchBarData} />
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400 text-xs">
              {t('analytics.noATSData')}
            </div>
          )}
        </div>
      </div>

      {/* Jobs by status - horizontal bars */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-gray-400" />
          {t('analytics.jobsByStatus')}
        </h3>
        <div className="space-y-3">
          {STATUS_KEYS.map((status) => {
            const count = stats.jobsByStatus[status] || 0
            const maxCount = Math.max(...Object.values(stats.jobsByStatus), 1)
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
            return (
              <div key={status} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{STATUS_LABELS(status)}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{count}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${STATUS_COLORS_BG[status]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick insights */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          {t('analytics.quickSummary')}
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            {t('analytics.inInterview', { count: stats.interviews })}
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            {t('analytics.offers', { count: stats.offers })}
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Clock className="w-3.5 h-3.5 text-yellow-500" />
            {t('analytics.drafts', { count: stats.jobsByStatus.draft })}
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            {t('analytics.rejected', { count: stats.jobsByStatus.rejected })}
          </div>
        </div>
      </div>

      {/* Career advice */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          {t('analytics.careerAdvice')}
        </h3>
        {adviceLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('analytics.generatingAdvice')}
          </div>
        ) : advice ? (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                {t('analytics.diagnosis')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {advice.diagnostico}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {t('analytics.improvementArea')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {advice.areaMejora}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                {t('analytics.actionPlan')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {advice.planAccion}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 py-2">
            {stats.totalJobs === 0
              ? t('analytics.noJobsAdvice')
              : t('analytics.configureAPIAdvice')}
          </div>
        )}
      </div>

      {/* Ver roadmap */}
      <button
        onClick={() => setCurrentView('roadmap')}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
      >
        <Map className="w-4 h-4" />
        Ver roadmap profesional
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
