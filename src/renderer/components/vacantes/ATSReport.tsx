import { useState } from 'react'
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Lightbulb, TrendingUp, CheckSquare, Square, Loader2, X, Banknote, Wand2, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '../ui/Button'
import type { ATSReport } from '../../../shared/types'
import { useTranslation } from 'react-i18next'

interface ATSReportViewProps {
  report: ATSReport
  onRefresh: () => void
  onAddKeywords?: (keywords: { keyword: string; level: string }[]) => Promise<void>
  /** Si hay CV generado: aplica una sugerencia directamente al CV. */
  onApplyToCv?: (instruction: string) => Promise<void>
}

function formatAmount(n: number, currency?: string): string {
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
    } catch {
      // Moneda inválida: se formatea sin símbolo.
    }
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
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

/** Frase en lenguaje sencillo que explica qué significa el porcentaje. */
function scoreVerdict(score: number): 'great' | 'good' | 'low' {
  return score >= 80 ? 'great' : score >= 60 ? 'good' : 'low'
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

export function ATSReportView({ report, onRefresh, onAddKeywords, onApplyToCv }: ATSReportViewProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [showProficiencyModal, setShowProficiencyModal] = useState(false)
  const [proficiencyLevels, setProficiencyLevels] = useState<Record<string, string>>({})
  const [applyingFix, setApplyingFix] = useState<number | null>(null)
  const [appliedFixes, setAppliedFixes] = useState<Set<number>>(new Set())

  const applyFix = async (index: number, fix: string) => {
    if (!onApplyToCv || applyingFix !== null) return
    setApplyingFix(index)
    try {
      await onApplyToCv(fix)
      setAppliedFixes((prev) => new Set(prev).add(index))
    } finally {
      setApplyingFix(null)
    }
  }

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

  const sr = report.salaryRange
  const salaryText = sr
    ? sr.min != null && sr.max != null
      ? sr.min === sr.max
        ? formatAmount(sr.min, sr.currency)
        : `${formatAmount(sr.min, sr.currency)} – ${formatAmount(sr.max, sr.currency)}`
      : sr.min != null
        ? `≥ ${formatAmount(sr.min, sr.currency)}`
        : sr.max != null
          ? `≤ ${formatAmount(sr.max, sr.currency)}`
          : null
    : null
  const salaryPeriod = sr ? (() => {
    const p = (sr.period || '').toLowerCase()
    if (/(mensual|month)/.test(p)) return t('atsReport.salaryPerMonth')
    if (/(anual|year|año)/.test(p)) return t('atsReport.salaryPerYear')
    if (/(hora|hour)/.test(p)) return t('atsReport.salaryPerHour')
    return sr.period || ''
  })() : ''
  const hasSalary = !!sr && (salaryText != null || !!sr.note)

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
      <div className="flex flex-col items-center gap-2 py-4">
        <ScoreBadge score={report.matchScore} />
        <p className="text-sm text-center text-gray-600 dark:text-gray-300 max-w-md">
          {t(`atsPlain.verdict.${scoreVerdict(report.matchScore)}`, { score: report.matchScore, missing: report.keywordsMissing.length })}
        </p>
      </div>

      {/* Reference Salary Range */}
      {hasSalary && (
        <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5" />
            {t('atsReport.salaryTitle')}
          </p>
          {salaryText && (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{salaryText}</span>
              {salaryPeriod && <span className="text-xs text-emerald-700 dark:text-emerald-400">/ {salaryPeriod}</span>}
            </div>
          )}
          {sr?.note && <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{sr.note}</p>}
          <p className="text-[11px] text-gray-400 mt-2">{t('atsReport.salaryEstimated')}</p>
        </div>
      )}

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
              <span className="flex-1">{q}</span>
              {onApplyToCv && (
                appliedFixes.has(i) ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <Check className="w-3.5 h-3.5" />
                    {t('atsPlain.applied')}
                  </span>
                ) : (
                  <button
                    onClick={() => applyFix(i, q)}
                    disabled={applyingFix !== null}
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50"
                  >
                    {applyingFix === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    {t('atsPlain.applyToCv')}
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
        {!onApplyToCv && report.quickFixes.length > 0 && (
          <p className="text-[11px] text-purple-600/70 dark:text-purple-400/70 mt-2">{t('atsPlain.applyHint')}</p>
        )}
      </div>

      {/* Full Analysis */}
      {report.analysis && (
        <details className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <summary className="cursor-pointer select-none text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t('atsReport.detailedAnalysis')}
          </summary>
          <div className="prose prose-sm dark:prose-invert max-w-none mt-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report.analysis}
            </ReactMarkdown>
          </div>
        </details>
      )}

      {/* Proficiency Modal */}
      {showProficiencyModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('atsPlain.levelTitle')}</h3>
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
                        {t(`atsPlain.levels.${level === 'Básico' ? 'basic' : level === 'Intermedio' ? 'intermediate' : 'advanced'}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setShowProficiencyModal(false)} className="flex-1 px-4 py-2 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                {t('sendCv.cancel')}
              </button>
              <button onClick={handleConfirmProficiency} disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {saving ? t('apiSetupModal.saving') : t('atsPlain.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
