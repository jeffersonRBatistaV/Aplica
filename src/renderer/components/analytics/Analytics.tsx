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
} from 'lucide-react'
import type { Conversation, JobApplication, JobStatus } from '../../../shared/types'

interface Stats {
  totalConversations: number
  totalMessages: number
  totalJobs: number
  jobsByStatus: Record<JobStatus, number>
  avgMatchScore: number
  interviews: number
  offers: number
}

const STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Borrador',
  applied: 'Aplicada',
  interview: 'Entrevista',
  offer: 'Oferta',
  rejected: 'Rechazada',
}

const STATUS_COLORS: Record<JobStatus, string> = {
  draft: 'bg-gray-400',
  applied: 'bg-blue-500',
  interview: 'bg-yellow-500',
  offer: 'bg-green-500',
  rejected: 'bg-red-500',
}

export function Analytics() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [conversations, jobs] = await Promise.all([
          window.api.getConversations(),
          window.api.getJobs(),
        ])
        computeStats(conversations, jobs)
      } catch (e) {
        console.error('Failed to load analytics data', e)
      } finally {
        setLoading(false)
      }
    }
    load()
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

    for (const job of jobs) {
      jobsByStatus[job.status] = (jobsByStatus[job.status] || 0) + 1
      if (job.atsReport?.matchScore != null) {
        totalScore += job.atsReport.matchScore
        scoreCount++
      }
      if (job.status === 'interview') interviews++
      if (job.status === 'offer') offers++
    }

    setStats({
      totalConversations,
      totalMessages,
      totalJobs: jobs.length,
      jobsByStatus,
      avgMatchScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
      interviews,
      offers,
    })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-gray-400">Cargando estadísticas...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-gray-400">No se pudieron cargar las estadísticas</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-blue-500" />
        Estadísticas
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1">
          <div className="flex items-center gap-2 text-gray-400">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Conversaciones</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalConversations}</p>
          <p className="text-xs text-gray-400">{stats.totalMessages} mensajes totales</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1">
          <div className="flex items-center gap-2 text-gray-400">
            <Briefcase className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Postulaciones</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalJobs}</p>
          <p className="text-xs text-gray-400">{stats.interviews} entrevistas, {stats.offers} ofertas</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1">
          <div className="flex items-center gap-2 text-gray-400">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Match Promedio</span>
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
            <span className="text-xs font-medium uppercase tracking-wider">Tasa de Éxito</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalJobs > 0 ? Math.round((stats.offers / stats.totalJobs) * 100) : 0}%
          </p>
          <p className="text-xs text-gray-400">{stats.offers} ofertas de {stats.totalJobs} postulaciones</p>
        </div>
      </div>

      {/* Jobs by status */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-gray-400" />
          Postulaciones por Estado
        </h3>
        <div className="space-y-3">
          {(Object.entries(STATUS_LABELS) as [JobStatus, string][]).map(([status, label]) => {
            const count = stats.jobsByStatus[status] || 0
            const maxCount = Math.max(...Object.values(stats.jobsByStatus), 1)
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
            return (
              <div key={status} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{label}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{count}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${STATUS_COLORS[status]}`}
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
          Resumen Rápido
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            En entrevista: {stats.interviews}
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            Ofertas: {stats.offers}
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Clock className="w-3.5 h-3.5 text-yellow-500" />
            Borradores: {stats.jobsByStatus.draft}
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            Rechazadas: {stats.jobsByStatus.rejected}
          </div>
        </div>
      </div>
    </div>
  )
}
