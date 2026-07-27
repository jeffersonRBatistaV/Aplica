import { useState, useEffect, useCallback } from 'react'
import { Map, RefreshCw, Loader2, Clock, AlertTriangle, CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import type { Roadmap, RoadmapPhase, RoadmapAction } from '../../../shared/types'
import { useTranslation } from 'react-i18next'

const PRIORITY_COLORS: Record<string, string> = {
  alta: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  media: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  baja: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
}

const PHASE_COLORS = [
  { border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50 dark:bg-blue-900/10', icon: 'text-blue-500', dot: 'bg-blue-500' },
  { border: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-900/10', icon: 'text-amber-500', dot: 'bg-amber-500' },
  { border: 'border-green-200 dark:border-green-800', bg: 'bg-green-50 dark:bg-green-900/10', icon: 'text-green-500', dot: 'bg-green-500' },
]

function ActionCard({ action, index }: { action: RoadmapAction; index: number }) {
  const priorityClass = PRIORITY_COLORS[action.priority] || PRIORITY_COLORS.media
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <div className="shrink-0 mt-0.5">
        <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">{action.title}</h4>
          <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${priorityClass}`}>
            {action.priority}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{action.description}</p>
      </div>
    </div>
  )
}

function PhaseCard({ phase, phaseIndex }: { phase: RoadmapPhase; phaseIndex: number }) {
  const colors = PHASE_COLORS[phaseIndex % PHASE_COLORS.length]
  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-full ${colors.dot} flex items-center justify-center text-white text-xs font-bold`}>
          {phaseIndex + 1}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{phase.name}</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {phase.timeframe}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {phase.actions.map((action, i) => (
          <ActionCard key={i} action={action} index={i} />
        ))}
      </div>
    </div>
  )
}

export function RoadmapView() {
  const { t } = useTranslation()
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [hasProfile, setHasProfile] = useState<boolean | null>(null)

  const loadRoadmap = useCallback(async () => {
    try {
      const cached = await window.api.getRoadmap()
      if (cached) {
        setRoadmap(cached)
        setLoading(false)
        setHasProfile(true)
      } else {
        const profile = await window.api.getProfile()
        if (!profile) {
          setHasProfile(false)
          setLoading(false)
          return
        }
        setHasProfile(true)
        const fresh = await window.api.refreshRoadmap()
        setRoadmap(fresh)
        setLoading(false)
      }
    } catch {
      setError('Error al cargar el roadmap')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRoadmap()
  }, [loadRoadmap])

  useEffect(() => {
    const handler = () => {
      setRefreshing(true)
      window.api.getProfile().then((profile) => {
        if (!profile) {
          setHasProfile(false)
          setRefreshing(false)
          return
        }
        setHasProfile(true)
        window.api.refreshRoadmap().then((fresh) => {
          if (fresh) setRoadmap(fresh)
          setRefreshing(false)
        }).catch(() => setRefreshing(false))
      })
    }
    window.addEventListener('profile:updated', handler)
    return () => window.removeEventListener('profile:updated', handler)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const fresh = await window.api.refreshRoadmap()
      if (fresh) setRoadmap(fresh)
    } catch {
      setError('Error al regenerar el roadmap')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando roadmap...
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Map className="w-5 h-5 text-blue-500" />
          Roadmap Profesional
        </h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Regenerando...' : 'Regenerar'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!roadmap && !loading && !error && hasProfile === false && (
        <div className="text-center py-12 space-y-3">
          <Map className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Completa tu perfil profesional para generar tu roadmap personalizado.
          </p>
        </div>
      )}

      {!roadmap && !loading && !error && hasProfile === true && (
        <div className="text-center py-12 space-y-3">
          <Map className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Completa tu perfil y selecciona un mercado objetivo para generar tu roadmap.
          </p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Generar roadmap
          </button>
        </div>
      )}

      {roadmap && (
        <>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Mercado: <span className="font-medium text-gray-700 dark:text-gray-300">{roadmap.targetMarket}</span></span>
            <span>·</span>
            <span>Generado: {new Date(roadmap.generatedAt).toLocaleDateString('es')}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {roadmap.phases.map((phase, i) => (
              <PhaseCard key={i} phase={phase} phaseIndex={i} />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500 pt-2">
            <ArrowRight className="w-3 h-3" />
            El roadmap se actualiza automáticamente cuando cambias tu perfil
          </div>
        </>
      )}
    </div>
  )
}
