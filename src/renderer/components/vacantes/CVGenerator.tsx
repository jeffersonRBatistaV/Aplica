import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { FileText, Copy, Check, Download, Sparkles, BarChart3, ScrollText, Loader2, Eye, EyeOff, Wand2, AlertCircle, Plus, Trash2, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import type { ATSReport, CvTemplate } from '../../../shared/types'

interface SummaryOption {
  id: string
  label: string
  summary: string
}

interface CVGeneratorProps {
  vacancyText: string
  atsReport: ATSReport | null
  currentStyle: string | null
  currentContent: string
  onSave: (style: string, content: string) => void
}

type CvTab = 'preview' | 'edit'
type CvStep = 'style' | 'summary' | 'generated'

const SUMMARY_CARD_ICONS: Record<string, any> = {
  tecnicista: BarChart3,
  ejecutivo: Sparkles,
  creativo: ScrollText,
}

const colorClasses: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-500', text: 'text-blue-700 dark:text-blue-300', hover: 'hover:border-blue-400' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-500', text: 'text-purple-700 dark:text-purple-300', hover: 'hover:border-purple-400' },
  green: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-500', text: 'text-green-700 dark:text-green-300', hover: 'hover:border-green-400' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-900/20', border: 'border-slate-500', text: 'text-slate-700 dark:text-slate-300', hover: 'hover:border-slate-400' },
}

export function CVGenerator({ vacancyText, atsReport, currentStyle, currentContent, onSave }: CVGeneratorProps) {
  const { t } = useTranslation()

  const BUILTIN_STYLES = useMemo(() => [
    { id: 'ats', name: 'ATS-Friendly', icon: BarChart3, desc: t('cvGenerator.styleAtsDesc'), color: 'blue' as const },
    { id: 'moderno', name: 'Moderno', icon: Sparkles, desc: t('cvGenerator.styleModernoDesc'), color: 'purple' as const },
    { id: 'tradicional', name: 'Tradicional', icon: ScrollText, desc: t('cvGenerator.styleTraditionalDesc'), color: 'green' as const },
  ], [t])

  const getStyleName = useCallback((id: string | null, templates: CvTemplate[]): string => {
    const builtin = BUILTIN_STYLES.find(s => s.id === id)
    if (builtin) return builtin.name
    if (id && id.startsWith('custom:')) {
      const tmpl = templates.find(t => `custom:${t.id}` === id)
      if (tmpl) return tmpl.name
    }
    return id || ''
  }, [BUILTIN_STYLES])
  const [step, setStep] = useState<CvStep>(currentStyle && currentContent ? 'generated' : 'style')
  const [generating, setGenerating] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState<string | null>(currentStyle)
  const [content, setContent] = useState(currentContent)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [tab, setTab] = useState<CvTab>('preview')
  const [instructions, setInstructions] = useState('')
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const [customTemplates, setCustomTemplates] = useState<CvTemplate[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const [summaryOptions, setSummaryOptions] = useState<SummaryOption[] | null>(null)
  const [loadingSummaries, setLoadingSummaries] = useState(false)
  const autoSelectedRef = useRef<string | null>(null)

  useEffect(() => {
    window.api?.getCvTemplates().then(setCustomTemplates)
  }, [])

  useEffect(() => { setContent(currentContent) }, [currentContent])
  useEffect(() => { setSelectedStyle(currentStyle) }, [currentStyle])

  useEffect(() => {
    if (!currentStyle) return
    if (autoSelectedRef.current === currentStyle) return
    if (step === 'generated' && currentContent) return
    if (generating || loadingSummaries) return
    autoSelectedRef.current = currentStyle
    if (step !== 'style') setStep('style')
    handleChooseStyle(currentStyle)
  }, [currentStyle, currentContent])

  const getCustomPrompt = useCallback((styleId: string): string | undefined => {
    if (!styleId.startsWith('custom:')) return undefined
    const t = customTemplates.find(t => `custom:${t.id}` === styleId)
    return t?.prompt
  }, [customTemplates])

  const handleChooseStyle = async (styleId: string) => {
    if (!window.api || generating) return
    setSelectedStyle(styleId)
    setError(null)
    setSummaryOptions(null)
    setLoadingSummaries(true)
    try {
      const options = await window.api.generateSummaryOptions(vacancyText, atsReport)
      setSummaryOptions(options)
      setStep('summary')
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('cvGenerator.errorGeneratingSummary')
      setError(msg)
    } finally {
      setLoadingSummaries(false)
    }
  }

  const handleSelectSummary = async (summary: string) => {
    if (!window.api || !selectedStyle || generating) return
    setGenerating(true)
    setError(null)
    try {
      const customPrompt = getCustomPrompt(selectedStyle)
      const result = await window.api.generateCV(vacancyText, atsReport, selectedStyle, customPrompt, summary)
      setContent(result)
      onSave(selectedStyle, result)
      setStep('generated')
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('cvGenerator.errorGeneratingCv')
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async (styleId: string) => {
    if (!window.api || generating) return
    setGenerating(true)
    setError(null)
    setSelectedStyle(styleId)
    try {
      const customPrompt = getCustomPrompt(styleId)
      const result = await window.api.generateCV(vacancyText, atsReport, styleId, customPrompt)
      setContent(result)
      onSave(styleId, result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('cvGenerator.errorGeneratingCv')
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  const handleApplyInstructions = async () => {
    if (!instructions.trim() || !selectedStyle || !window.api) return
    setApplying(true)
    setError(null)
    try {
      const customPrompt = getCustomPrompt(selectedStyle)
      const result = await window.api.regenerateCV({
        currentCv: content,
        style: selectedStyle,
        vacancyText,
        atsReport,
        instructions: instructions.trim(),
        customPrompt,
      })
      setContent(result)
      onSave(selectedStyle, result)
      setInstructions('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('cvGenerator.errorApplying')
      setError(msg)
    } finally {
      setApplying(false)
    }
  }

  const handleCopy = async () => {
    await window.api?.copyToClipboard(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadPdf = async () => {
    if (!window.api || downloading) return
    setDownloading(true)
    setSavedPath(null)
    try {
      const path = await window.api.downloadCvPdf(content, selectedStyle!)
      if (path) setSavedPath(path)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('cvGenerator.errorDownloading')
      setError(msg)
    } finally {
      setDownloading(false)
    }
  }

  const handleEditorChange = (value: string) => {
    setContent(value)
    if (selectedStyle) onSave(selectedStyle, value)
  }

  const handleCreateTemplate = async () => {
    if (!newName.trim() || !newPrompt.trim() || !window.api) return
    setSavingTemplate(true)
    try {
      const template: CvTemplate = {
        id: crypto.randomUUID(),
        name: newName.trim(),
        prompt: newPrompt.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await window.api.saveCvTemplate(template)
      setCustomTemplates(prev => [...prev, template])
      setNewName('')
      setNewPrompt('')
      setShowCreateForm(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('cvGenerator.errorSavingTemplate')
      setError(msg)
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!window.api) return
    try {
      await window.api.deleteCvTemplate(id)
      setCustomTemplates(prev => prev.filter(t => t.id !== id))
      if (selectedStyle === `custom:${id}`) {
        setSelectedStyle(null)
        setContent('')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('cvGenerator.errorDeletingTemplate')
      setError(msg)
    }
  }

  // ── Style Selection Step ──
  if (step === 'style') {
    return (
      <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('cvGenerator.title')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {t('cvGenerator.selectStyle')}
          </p>
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Built-in styles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BUILTIN_STYLES.map((s) => {
            const cc = colorClasses[s.color]
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => handleChooseStyle(s.id)}
                disabled={loadingSummaries}
                className={`p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400 border-gray-200 dark:border-gray-700 disabled:opacity-50`}
              >
                {loadingSummaries && selectedStyle === s.id ? (
                  <Loader2 className={`w-6 h-6 mb-2 animate-spin ${cc.text}`} />
                ) : (
                  <Icon className="w-6 h-6 mb-2 text-gray-400" />
                )}
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.desc}</div>
              </button>
            )
          })}
        </div>

        {/* Custom templates */}
        {customTemplates.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('cvGenerator.yourTemplates')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {customTemplates.map((t) => {
                const styleId = `custom:${t.id}`
                const isSelected = selectedStyle === styleId
                const cc = colorClasses.slate
                return (
                  <button
                    key={t.id}
                    onClick={() => handleChooseStyle(styleId)}
                    disabled={loadingSummaries}
                    className={`p-4 rounded-xl border-2 text-left transition-all relative group ${
                      isSelected ? `${cc.border} ${cc.bg}` : 'border-gray-200 dark:border-gray-700 hover:border-slate-400'
                    } disabled:opacity-50`}
                  >
                    {loadingSummaries && isSelected ? (
                      <Loader2 className={`w-6 h-6 mb-2 animate-spin ${cc.text}`} />
                    ) : (
                      <FileText className="w-6 h-6 mb-2 text-gray-400" />
                    )}
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{t.prompt.slice(0, 80)}...</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id) }}
                      className="absolute top-2 right-2 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Create template */}
        <div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {showCreateForm ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Plus className="w-3.5 h-3.5" />
            {t('cvGenerator.createTemplate')}
          </button>

          {showCreateForm && (
            <div className="mt-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('cvGenerator.templateName')}</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('cvGenerator.templateNamePlaceholder')}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t('cvGenerator.templatePrompt')}
                </label>
                <textarea
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  rows={5}
                  placeholder={t('cvGenerator.templatePromptPlaceholder')}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y font-mono"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateTemplate}
                  disabled={!newName.trim() || !newPrompt.trim() || savingTemplate}
                >
                  {savingTemplate ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {t('cvGenerator.saveTemplate')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {loadingSummaries && selectedStyle && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            {t('cvGenerator.preparingSummaries')}
          </div>
        )}
      </div>
    )
  }

  // ── Summary Selection Step ──
  if (step === 'summary' && summaryOptions) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep('style')}
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('cvGenerator.chooseSummary')}
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('cvGenerator.selectSummary')}
        </p>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {summaryOptions.map((opt) => {
            const Icon = SUMMARY_CARD_ICONS[opt.id] || FileText
            return (
              <button
                key={opt.id}
                onClick={() => handleSelectSummary(opt.summary)}
                disabled={generating}
                className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 text-left transition-all disabled:opacity-50 group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                    <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {t('cvGenerator.focusPrefix')}{opt.label}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {opt.summary}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {generating && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            {t('cvGenerator.generatingWithSummary')}
          </div>
        )}
      </div>
    )
  }

  // ── Generated View ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {t('cvGenerator.cvPrefix')}{getStyleName(selectedStyle, customTemplates)}
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 flex-wrap">
            {BUILTIN_STYLES.map((s) => {
              const cc = colorClasses[s.color]
              const isSelected = selectedStyle === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => handleRegenerate(s.id)}
                  disabled={generating}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    isSelected ? `${cc.border} ${cc.bg} ${cc.text}` : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {s.name}
                </button>
              )
            })}
            {customTemplates.map((t) => {
              const styleId = `custom:${t.id}`
              const isSelected = selectedStyle === styleId
              return (
                <button
                  key={t.id}
                  onClick={() => handleRegenerate(styleId)}
                  disabled={generating}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    isSelected
                      ? 'border-slate-500 bg-slate-50 dark:bg-slate-900/20 text-slate-700 dark:text-slate-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {generating && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          {t('cvGenerator.regenerating')}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!generating && content && (
        <>
          {/* Tab bar */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-4">
              <button
                onClick={() => setTab('preview')}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                  tab === 'preview'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {t('cvGenerator.preview')}
              </button>
              <button
                onClick={() => setTab('edit')}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                  tab === 'edit'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                {t('cvGenerator.editor')}
              </button>
            </div>
            <div className="flex items-center gap-1 pb-2">
              <Button variant="ghost" size="sm" onClick={handleCopy} title={t('cvGenerator.copy')}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button variant="primary" size="sm" onClick={handleDownloadPdf} disabled={downloading}>
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {downloading ? t('cvGenerator.generatingPdf') : t('cvGenerator.download')}
              </Button>
            </div>
          </div>

          {/* Preview */}
          {tab === 'preview' && (
            <div
              ref={previewRef}
              className="bg-white rounded-lg border border-gray-200 dark:border-gray-700 p-6 min-h-[300px] overflow-x-auto"
              style={{ fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}
            >
              <div dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          )}

          {/* Editor */}
          {tab === 'edit' && (
            <textarea
              value={content}
              onChange={(e) => handleEditorChange(e.target.value)}
              className="w-full h-96 px-4 py-3 text-xs font-mono rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              spellCheck={false}
            />
          )}

          {/* AI Instructions */}
          <div className="flex gap-2">
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleApplyInstructions()
                }
              }}
              placeholder={t('cvGenerator.instructionsPlaceholder')}
              className="flex-1 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyInstructions}
              disabled={!instructions.trim() || applying}
            >
              {applying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {t('cvGenerator.apply')}
            </Button>
          </div>

          {/* Saved path banner */}
          {savedPath && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-200 dark:border-green-800">
              <Check className="w-3.5 h-3.5" />
              <span>{t('cvGenerator.pdfSaved')}{savedPath}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}