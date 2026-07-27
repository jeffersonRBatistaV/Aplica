import { useState } from 'react'
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Lightbulb, TrendingUp, CheckSquare, Square, Loader2, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '../ui/Button'
import type { ATSReport } from '../../../shared/types'
import { useTranslation } from 'react-i18next'

interface ATSReportViewProps {
  report: ATSReport
  onRefresh: () => void
  onAddKeywords?: (keywords: { keyword: string; level: string }[]) => Promise<void>
}

function ScoreBadge({ score }: { score: number }) {
  const { t } = useTranslation()
  const color =
    score >= 80 ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' :
    score >= 60 ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30' :
    'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${color}`}>
      <TrendingUp className="w-5 h-5" />
      <span className="text-2xl font-bold">{score}%</span>
      <span className="text-sm font-medium">{t('atsReport.match')}</span>
    </div>
  )
}

function MissingKeywordList({
  items,
  selected,
  onToggle,
}: {
  items: string[]
  selected: Set<string>
  onToggle: (keyword: string) => void
}) {
  const { t } = useTranslation()
  if (items.length === 0) return <p className="text-sm text-gray-400">{t('atsReport.none')}</p>
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const isSelected = selected.has(item)
        return (
          <button
            key={item}
            onClick={() => onToggle(item)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
              isSelected
                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                : 'text-red-800 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
          >
            {isSelected ? (
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Square className="w-3.5 h-3.5 shrink-0" />
            )}
            {item}
          </button>
        )
      })}
    </div>
  )
}

export function ATSReportView({ report, onRefresh, onAddKeywords }: ATSReportViewProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [showProficiencyModal, setShowProficiencyModal] = useState(false)
  const [proficiencyLevels, setProficiencyLevels] = useState<Record<string, string>>({})

  const toggleKeyword = (keyword: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(keyword)) next.delete(keyword)
      else next.add(keyword)
      return next
    })
  }

  const handleAddSelected = async () => {
    if (!onAddKeywords || selected.size === 0) return
    const initial: Record<string, string> = {}
    selected.forEach(kw => { initial[kw] = 'Intermedio' })
    setProficiencyLevels(initial)
    setShowProficiencyModal(true)
  }

  const handleConfirmProficiency = async () => {
    if (!onAddKeywords) return
    setSaving(true)
    try {
      const keywords = Array.from(selected).map(kw => ({ keyword: kw, level: proficiencyLevels[kw] || 'Intermedio' }))
      await onAddKeywords(keywords)
      setSelected(new Set())
      setShowProficiencyModal(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{t('atsReport.title')}</h3>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="w-3.5 h-3.5" />
          {t('atsReport.reAnalyze')}
        </Button>
      </div>

      {/* Match Score */}
      <div className="flex justify-center py-4">
        <ScoreBadge score={report.matchScore} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
          <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('atsReport.keywordsPresent')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {report.keywordsPresent.length === 0 ? (
              <p className="text-sm text-gray-400">{t('atsReport.none')}</p>
            ) : report.keywordsPresent.map((item) => (
              <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-200/60 dark:bg-green-800/40 text-green-800 dark:text-green-300">
                <CheckCircle2 className="w-3 h-3" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            {t('atsReport.keywordsMissing')}
          </p>
          <MissingKeywordList
            items={report.keywordsMissing}
            selected={selected}
            onToggle={toggleKeyword}
          />
          {report.keywordsMissing.length > 0 && (
            <button
              onClick={handleAddSelected}
              disabled={selected.size === 0 || saving}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {saving ? t('atsReport.adding') : t('atsReport.addSelected', { count: selected.size })}
            </button>
          )}
        </div>
      </div>

      {/* Strengths */}
      <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
        <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" />
          {t('atsReport.strengths')}
        </p>
        <ul className="space-y-1">
          {report.strengths.map((s, i) => (
            <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              {s}
            </li>
          ))}
        </ul>
      </div>

      {/* Gaps */}
      <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          {t('atsReport.gaps')}
        </p>
        <ul className="space-y-1">
          {report.gaps.map((g, i) => (
            <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              {g}
            </li>
          ))}
        </ul>
      </div>

      {/* Quick Fixes */}
      <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10">
        <p className="text-xs font-medium text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-1">
          <Lightbulb className="w-3.5 h-3.5" />
          {t('atsReport.quickFixes')}
        </p>
        <ul className="space-y-1">
          {report.quickFixes.map((q, i) => (
            <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              {q}
            </li>
          ))}
        </ul>
      </div>

      {/* Full Analysis */}
      {report.analysis && (
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
            {t('atsReport.detailedAnalysis')}
          </p>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report.analysis}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Proficiency Modal */}
      {showProficiencyModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">¿Cuál es tu nivel con estas skills?</h3>
              <button onClick={() => setShowProficiencyModal(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {Array.from(selected).map((kw) => (
                <div key={kw} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{kw}</span>
                  <div className="flex gap-1 shrink-0">
                    {(['Básico', 'Intermedio', 'Avanzado'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setProficiencyLevels(prev => ({ ...prev, [kw]: level }))}
                        className={`px-2 py-1 text-[10px] font-medium rounded-full transition-colors ${
                          proficiencyLevels[kw] === level
                            ? level === 'Básico' ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            : level === 'Intermedio' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                            : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setShowProficiencyModal(false)} className="flex-1 px-4 py-2 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                Cancelar
              </button>
              <button onClick={handleConfirmProficiency} disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
