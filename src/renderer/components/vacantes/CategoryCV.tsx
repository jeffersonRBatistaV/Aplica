import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Plus, Trash2, FileText, ArrowLeft, Loader2, AlertCircle, Check, Briefcase, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { CVGenerator } from './CVGenerator'
import { areas } from '../../data/questions'
import { buildCategoryText } from '../../../shared/categories'
import type { JobCategory, JobApplication, Profile } from '../../../shared/types'

type Step = 'list' | 'position' | 'cv'

export function CategoryCV() {
  const { t } = useTranslation()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [areaId, setAreaId] = useState('tecnologia')
  const [categories, setCategories] = useState<JobCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiProposals, setAiProposals] = useState<JobCategory[] | null>(null)
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set())

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newKeywords, setNewKeywords] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  const [step, setStep] = useState<Step>('list')
  const [activeCategory, setActiveCategory] = useState<JobCategory | null>(null)
  const [positionName, setPositionName] = useState('')
  const [creatingCv, setCreatingCv] = useState(false)
  const [jobApp, setJobApp] = useState<JobApplication | null>(null)
  const [cvStyle, setCvStyle] = useState<string | null>(null)
  const [cvContent, setCvContent] = useState('')
  const [savedByCategory, setSavedByCategory] = useState<Record<string, JobApplication[]>>({})
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<JobCategory | null>(null)

  const reloadSaved = useCallback(async () => {
    if (!window.api) return
    const jobs = await window.api.getJobs()
    const map: Record<string, JobApplication[]> = {}
    for (const j of jobs) {
      if (j.cvContent && j.category) {
        (map[j.category] ??= []).push(j)
      }
    }
    setSavedByCategory(map)
  }, [])

  const reloadCategories = useCallback(async (area: string) => {
    if (!window.api) return
    setLoading(true)
    setError(null)
    try {
      const list = await window.api.getCategories(area)
      setCategories(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('categoryCV.error', { msg: String(err) }))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    window.api?.getProfile().then((p) => {
      setProfile(p)
      if (p?.area) setAreaId(p.area)
    })
  }, [])

  useEffect(() => {
    reloadSaved()
  }, [reloadSaved])

  useEffect(() => {
    reloadCategories(areaId)
  }, [areaId, reloadCategories])

  const handleGenerateAI = async () => {
    if (!window.api || aiGenerating) return
    setAiGenerating(true)
    setError(null)
    try {
      const proposals = await window.api.generateCategories(areaId)
      setAiProposals(proposals)
      setSelectedProposals(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('categoryCV.error', { msg: String(err) }))
    } finally {
      setAiGenerating(false)
    }
  }

  const toggleProposal = (id: string) => {
    setSelectedProposals((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddProposals = async () => {
    if (!window.api) return
    const toAdd = aiProposals?.filter((c) => selectedProposals.has(c.id)) ?? []
    if (toAdd.length === 0) return
    setSavingCategory(true)
    try {
      for (const cat of toAdd) {
        await window.api.saveCategory(cat)
      }
      await reloadCategories(areaId)
      setAiProposals(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('categoryCV.error', { msg: String(err) }))
    } finally {
      setSavingCategory(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!window.api || !newName.trim()) return
    setSavingCategory(true)
    setError(null)
    try {
      const cat: JobCategory = {
        id: crypto.randomUUID(),
        areaId,
        name: newName.trim(),
        description: newDesc.trim(),
        keywords: newKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        source: 'custom',
        createdAt: Date.now(),
      }
      await window.api.saveCategory(cat)
      setNewName('')
      setNewDesc('')
      setNewKeywords('')
      setShowAddForm(false)
      await reloadCategories(areaId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('categoryCV.error', { msg: String(err) }))
    } finally {
      setSavingCategory(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!window.api) return
    const cat = categories.find((c) => c.id === id)
    if (cat) {
      setPendingDeleteCategory(cat)
      return
    }
  }

  const confirmDeleteCategory = async () => {
    if (!pendingDeleteCategory || !window.api) return
    try {
      await window.api.deleteCategory(pendingDeleteCategory.id)
      await reloadCategories(areaId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('categoryCV.error', { msg: String(err) }))
    } finally {
      setPendingDeleteCategory(null)
    }
  }

  const handleStartCV = (cat: JobCategory) => {
    setActiveCategory(cat)
    setPositionName(cat.name)
    setJobApp(null)
    setCvStyle(null)
    setCvContent('')
    setError(null)
    setStep('position')
  }

  const handleCreateCV = async () => {
    if (!window.api || !activeCategory) return
    const name = positionName.trim() || activeCategory.name
    setCreatingCv(true)
    setError(null)
    try {
      const app: JobApplication = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        company: '',
        position: name,
        category: activeCategory.name,
        status: 'draft',
        vacancyText: buildCategoryText(activeCategory, name),
        atsReport: null,
        coverLetterA: '',
        coverLetterB: '',
        cvStyle: null,
        cvContent: '',
        recipientEmail: '',
        emailSubject: '',
        interviewQuestions: [],
      }
      await window.api.saveJob(app)
      setJobApp(app)
      setStep('cv')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('categoryCV.error', { msg: String(err) }))
    } finally {
      setCreatingCv(false)
    }
  }

  const handleSaveCV = async (style: string, content: string) => {
    if (!window.api || !jobApp) return
    const updated = { ...jobApp, cvStyle: style, cvContent: content, updatedAt: Date.now() }
    await window.api.saveJob(updated)
    setJobApp(updated)
    setCvStyle(style)
    setCvContent(content)
    await reloadSaved()
  }

  const handleOpenSaved = (app: JobApplication) => {
    setActiveCategory({
      id: app.category,
      areaId,
      name: app.category,
      description: '',
      keywords: [],
      source: 'custom',
      createdAt: app.createdAt,
    })
    setJobApp(app)
    setCvStyle(app.cvStyle)
    setCvContent(app.cvContent)
    setError(null)
    setStep('cv')
  }

  // ── Position name step (asks user for the target position name) ──
  if (step === 'position' && activeCategory) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep('list')}
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('categoryCV.generatedCVTitle', { category: activeCategory.name })}
          </h3>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">{activeCategory.description}</p>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {t('categoryCV.positionName')}
          </label>
          <input
            type="text"
            value={positionName}
            onChange={(e) => setPositionName(e.target.value)}
            placeholder={t('categoryCV.positionNamePlaceholder')}
            autoFocus
            className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('categoryCV.positionNameHint')}</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button variant="primary" onClick={handleCreateCV} disabled={creatingCv || !positionName.trim()}>
          {creatingCv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {t('categoryCV.confirmCV')}
        </Button>
      </div>
    )
  }

  // ── CV generation step ──
  if (step === 'cv' && jobApp) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep('list')}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('categoryCV.generatedCVTitle', { category: jobApp.position })}
            </h3>
          </div>
        </div>

        <CVGenerator
          vacancyText={jobApp.vacancyText}
          atsReport={null}
          currentStyle={cvStyle}
          currentContent={cvContent}
          onSave={handleSaveCV}
        />
      </div>
    )
  }

  // ── Category list step ──
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Briefcase className="w-4 h-4" />
          {t('categoryCV.title')}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('categoryCV.subtitle')}</p>
      </div>

      {!profile && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('categoryCV.noProfile')}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Area selector */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('categoryCV.selectArea')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {areas.map((a) => (
            <button
              key={a.id}
              onClick={() => setAreaId(a.id)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                areaId === a.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
              }`}
            >
              <div className="text-lg mb-1">{a.icon}</div>
              <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{a.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={handleGenerateAI} disabled={aiGenerating}>
          {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {aiGenerating ? t('categoryCV.generatingAI') : t('categoryCV.generateWithAI')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? <ChevronDown className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {t('categoryCV.addCategory')}
        </Button>
      </div>

      {/* AI proposals */}
      {aiProposals && aiProposals.length > 0 && (
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('categoryCV.aiProposalsTitle')}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('categoryCV.aiProposalsDesc')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {aiProposals.map((c) => {
              const selected = selectedProposals.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggleProposal(c.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</span>
                    {selected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{c.description}</p>
                </button>
              )
            })}
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={handleAddProposals} disabled={selectedProposals.size === 0 || savingCategory}>
              {savingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t('categoryCV.addSelected', { count: selectedProposals.size })}
            </Button>
          </div>
        </div>
      )}

      {/* Manual add form */}
      {showAddForm && (
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('categoryCV.newCategoryName')}</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('categoryCV.newCategoryDesc')}</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('categoryCV.newCategoryKeywords')}</label>
            <input
              type="text"
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              placeholder="React, TypeScript, Node.js, AWS..."
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>{t('categoryCV.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={handleCreateCategory} disabled={!newName.trim() || savingCategory}>
              {savingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {t('categoryCV.saveCategory')}
            </Button>
          </div>
        </div>
      )}

      {/* Categories list */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          {t('categoryCV.categoriesFor', { area: areas.find((a) => a.id === areaId)?.name || areaId })}
        </h4>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('categoryCV.generatingAI')}</span>
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
            {t('categoryCV.emptyCategories')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((cat) => {
              const saved = savedByCategory[cat.name] ?? []
              const lastSaved = saved[saved.length - 1]
              return (
                <div key={cat.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 flex flex-col gap-2 group relative">
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="absolute top-2 right-2 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t('categoryCV.deleteCategory')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-start justify-between gap-2 pr-6">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{cat.name}</div>
                    {lastSaved && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 whitespace-nowrap">
                        <Check className="w-3 h-3 inline-block mr-0.5" />
                        {t('categoryCV.savedCV')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 flex-1">{cat.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {cat.keywords.slice(0, 4).map((kw) => (
                      <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{kw}</span>
                    ))}
                    {cat.keywords.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400">+{cat.keywords.length - 4}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {lastSaved ? (
                      <Button variant="primary" size="sm" onClick={() => handleOpenSaved(lastSaved)}>
                        <FileText className="w-3.5 h-3.5" />
                        {t('categoryCV.openSavedCV')}
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => handleStartCV(cat)}>
                        <FileText className="w-3.5 h-3.5" />
                        {t('categoryCV.generateCV')}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteCategory !== null}
        title={t('categoryCV.deleteCategoryTitle')}
        message={t('categoryCV.deleteCategoryConfirm', { name: pendingDeleteCategory?.name || '' })}
        confirmLabel={t('categoryCV.deleteCategoryConfirmButton')}
        cancelLabel={t('categoryCV.deleteCategoryCancel')}
        variant="danger"
        onConfirm={confirmDeleteCategory}
        onCancel={() => setPendingDeleteCategory(null)}
      />
    </div>
  )
}
