import { useState, useEffect, useRef } from 'react'
import { FileText, Plus, Trash2, Check, Loader2, RotateCcw, Eye, EyeOff, ChevronDown, ChevronRight, X, AlertCircle, Copy, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import type { CvTemplate } from '../../../shared/types'
import { TemplateDesigner } from './TemplateDesigner'

interface TemplatesManagerProps {
  onSelect: (templateId: string) => void
}

const SEED_PREFIX = 'seed-'

// Pagina A4 a 96dpi: el preview se renderiza a tamano real y se escala al ancho disponible.
const PAGE_W = 794
const PAGE_H = 1123

function ScaledPreview({ html, title, crop = 1, interactive = false }: { html: string; title: string; crop?: number; interactive?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setScale(el.clientWidth / PAGE_W)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="relative w-full overflow-hidden bg-white" style={{ height: PAGE_H * scale * crop }}>
      {scale > 0 && (
        <iframe
          srcDoc={html}
          title={title}
          sandbox=""
          tabIndex={-1}
          className={`absolute top-0 left-0 max-w-none border-0 origin-top-left ${interactive ? '' : 'pointer-events-none'}`}
          style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}
        />
      )}
    </div>
  )
}

function TemplateCardBody({ template, isSelected }: { template: CvTemplate; isSelected: boolean }) {
  const { t } = useTranslation()
  return (
    <>
      {template.sampleHtml ? (
        <div className="rounded-t-[10px] overflow-hidden border-b border-gray-200 dark:border-gray-700">
          <ScaledPreview html={template.sampleHtml} title={template.name} crop={0.62} />
        </div>
      ) : (
        <div className="px-3 pt-3">
          <FileText className={`w-6 h-6 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
        </div>
      )}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{template.name}</span>
          {template.customized && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{t('templates.edited')}</span>
          )}
        </div>
        {!template.sampleHtml && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{template.prompt.slice(0, 60)}...</div>
        )}
      </div>
    </>
  )
}

export function TemplatesManager({ onSelect }: TemplatesManagerProps) {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<CvTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [editTargetId, setEditTargetId] = useState<string | null>(null)
  const [editPromptText, setEditPromptText] = useState('')
  const [editExtraPrompt, setEditExtraPrompt] = useState('')
  const [editName, setEditName] = useState('')
  const [savingClone, setSavingClone] = useState(false)
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [savingNew, setSavingNew] = useState(false)

  const loadTemplates = async () => {
    if (!window.api) return
    setLoading(true)
    try {
      const result = await window.api.getCvTemplates()
      setTemplates(result)
    } catch {
      setError('Error al cargar plantillas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTemplates() }, [])

  const selected = templates.find(t => t.id === selectedId)
  const isSeed = selectedId?.startsWith(SEED_PREFIX)

  useEffect(() => {
    setEditExtraPrompt(templates.find(t => t.id === selectedId)?.extraPrompt ?? '')
  }, [selectedId])

  const openCreateForm = () => {
    setNewName('')
    setNewPrompt('')
    setEditExtraPrompt('')
    setShowCreateForm(true)
  }

  const closeCreate = () => {
    setNewName('')
    setNewPrompt('')
    setEditExtraPrompt('')
    setShowCreateForm(false)
  }

  const handleReset = async () => {
    if (!window.api) return
    setResetting(true)
    try {
      await window.api.resetCvTemplates()
      await loadTemplates()
      setSelectedId(null)
    } catch {
      setError('Error al restaurar plantillas')
    } finally {
      setResetting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.api) return
    try {
      await window.api.deleteCvTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      if (selectedId === id) setSelectedId(null)
    } catch {
      setError('Error al eliminar plantilla')
    }
  }

  const handleEditClick = () => {
    if (!selected) return
    setEditTargetId(selected.id)
    setEditName(selected.name)
    setEditPromptText(selected.prompt)
    setEditExtraPrompt(selected.extraPrompt ?? '')
    setEditingPrompt(true)
  }

  const closeEdit = () => {
    setEditingPrompt(false)
    setEditTargetId(null)
    setEditExtraPrompt('')
  }

  const handleSaveInPlace = async () => {
    if (!window.api || !editTargetId || !editName.trim() || !editPromptText.trim()) return
    const existing = templates.find(t => t.id === editTargetId)
    if (!existing) return
    const promptChanged = editPromptText.trim() !== existing.prompt.trim()
    const nameChanged = editName.trim() !== existing.name
    setSavingClone(true)
    try {
      const template: CvTemplate = {
        ...existing,
        name: editName.trim(),
        prompt: editPromptText.trim(),
        updatedAt: Date.now(),
        extraPrompt: editExtraPrompt.trim() || undefined,
        // Una predeterminada con prompt/nombre editado deja de actualizarse sola con nuevos disenos.
        ...(existing.id.startsWith(SEED_PREFIX) && (promptChanged || nameChanged) ? { customized: true } : {}),
      }
      await window.api.saveCvTemplate(template)
      setTemplates(prev => prev.map(t => (t.id === template.id ? template : t)))
      setSelectedId(template.id)
      closeEdit()
      // La vista previa solo depende del prompt: no se regenera si solo cambian las instrucciones.
      if (promptChanged) {
        setGeneratingPreview(true)
        try {
          const withSample = { ...template, sampleHtml: await window.api.generateSampleCv(template.prompt) }
          await window.api.saveCvTemplate(withSample)
          setTemplates(prev => prev.map(t => (t.id === withSample.id ? withSample : t)))
        } catch {
          // La plantilla ya quedó guardada aunque el preview no se regenere.
        }
      }
    } catch {
      setError('Error al guardar plantilla')
    } finally {
      setSavingClone(false)
      setGeneratingPreview(false)
    }
  }

  const handleSaveClone = async () => {
    if (!window.api || !editName.trim() || !editPromptText.trim()) return
    setSavingClone(true)
    setGeneratingPreview(true)
    try {
      const id = crypto.randomUUID()
      const source = templates.find(t => t.id === editTargetId)
      const cloneName = editName.trim().endsWith('(copia)') ? editName.trim() : `${editName.trim()} (copia)`
      const template: CvTemplate = {
        id,
        name: cloneName,
        prompt: editPromptText.trim(),
        sampleHtml: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        extraPrompt: editExtraPrompt.trim() || source?.extraPrompt,
      }
      await window.api.saveCvTemplate(template)

      const sampleHtml = await window.api.generateSampleCv(template.prompt)
      template.sampleHtml = sampleHtml
      await window.api.saveCvTemplate(template)

      setTemplates(prev => [...prev, template])
      setSelectedId(template.id)
      closeEdit()
    } catch {
      setError('Error al guardar plantilla')
    } finally {
      setSavingClone(false)
      setGeneratingPreview(false)
    }
  }

  const handleCreateTemplate = async () => {
    if (!window.api || !newName.trim() || !newPrompt.trim()) return
    setSavingNew(true)
    setGeneratingPreview(true)
    try {
      const id = crypto.randomUUID()
      const template: CvTemplate = {
        id,
        name: newName.trim(),
        prompt: newPrompt.trim(),
        sampleHtml: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        extraPrompt: editExtraPrompt.trim() || undefined,
      }
      await window.api.saveCvTemplate(template)

      const sampleHtml = await window.api.generateSampleCv(template.prompt)
      template.sampleHtml = sampleHtml
      await window.api.saveCvTemplate(template)

      setTemplates(prev => [...prev, template])
      setSelectedId(template.id)
      setNewName('')
      setNewPrompt('')
      setEditExtraPrompt('')
      setShowCreateForm(false)
    } catch {
      setError('Error al guardar plantilla')
    } finally {
      setSavingNew(false)
      setGeneratingPreview(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  const seedTemplates = templates.filter(t => t.id.startsWith(SEED_PREFIX))
  const customTemplates = templates.filter(t => !t.id.startsWith(SEED_PREFIX))

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="max-w-6xl mx-auto w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Plantillas CV</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={resetting}>
              <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
              Restaurar predeterminadas
            </Button>
            <Button variant="primary" size="sm" onClick={() => (showCreateForm ? closeCreate() : openCreateForm())}>
              <Plus className="w-4 h-4" />
              Nueva plantilla
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-0.5"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Create form */}
        {showCreateForm && (
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('cvGenerator.templateName')}</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder={t('cvGenerator.templateNamePlaceholder')}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{t('templateDesigner.howShouldItLook')}</label>
              <TemplateDesigner value={newPrompt} onChange={setNewPrompt} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('templates.userInstructions')}</label>
              <textarea value={editExtraPrompt} onChange={(e) => setEditExtraPrompt(e.target.value)} rows={3}
                placeholder={t('templates.userInstructionsPlaceholder')}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={handleCreateTemplate}
                disabled={!newName.trim() || !newPrompt.trim() || savingNew}>
                {savingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {t('cvGenerator.saveTemplate')}
              </Button>
            </div>
            {!selected?.sampleHtml && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('templateDesigner.previewOnSave')}</p>
            )}
          </div>
        )}

        {/* Content: grid + preview */}
        <div className="flex gap-6">
          {/* Grid */}
          <div className={`${selectedId ? 'w-1/2' : 'w-full'} space-y-6`}>
            {seedTemplates.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Predeterminadas</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {seedTemplates.map((t) => {
                    const isSelected = selectedId === t.id
                    return (
                      <button key={t.id} onClick={() => setSelectedId(isSelected ? null : t.id)}
                        className={`rounded-xl border-2 text-left transition-all relative group ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                      >
                        <TemplateCardBody template={t} isSelected={isSelected} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {customTemplates.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Tus plantillas</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {customTemplates.map((t) => {
                    const isSelected = selectedId === t.id
                    return (
                      <div key={t.id}
                        className={`rounded-xl border-2 text-left transition-all relative group ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                      >
                        <button className="w-full text-left" onClick={() => setSelectedId(isSelected ? null : t.id)}>
                          <TemplateCardBody template={t} isSelected={isSelected} />
                        </button>
                        <button onClick={() => handleDelete(t.id)}
                          className="absolute top-2 right-2 p-1 rounded bg-white/90 dark:bg-gray-800/90 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {templates.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay plantillas disponibles</p>
              </div>
            )}
          </div>

          {/* Preview panel */}
          {selectedId && selected && (
            <div className="w-1/2 min-w-0">
              <div className="sticky top-0 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{selected.name}</h3>
                  <button onClick={() => setShowPreview(!showPreview)}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button variant="primary" size="sm" onClick={() => onSelect(selected.id)}>
                    Usar esta plantilla
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleEditClick}>
                    Editar prompt
                  </Button>
                  {!isSeed && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(selected.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Prompt */}
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Prompt</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">{selected.prompt}</p>
                </div>

                {/* User instructions */}
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Instrucciones del usuario (se aplican siempre)</p>
                    <Button variant="ghost" size="sm" onClick={handleEditClick} disabled={editingPrompt}>
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </Button>
                  </div>
                  {selected.extraPrompt ? (
                    <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">{selected.extraPrompt}</p>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500">Sin instrucciones personalizadas. Añádelas para que se apliquen siempre a los CVs de esta plantilla.</p>
                  )}
                </div>

                {/* Edit prompt form */}
                {editingPrompt && (
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nombre</label>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Prompt</label>
                      <textarea value={editPromptText} onChange={(e) => setEditPromptText(e.target.value)} rows={5}
                        className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y font-mono"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Los cambios en el prompt se aplican a los CVs que generes con esta plantilla.
                      {editTargetId?.startsWith(SEED_PREFIX) && ` ${t('templates.seedEditHint')}`}
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('templates.userInstructions')}</label>
                      <textarea value={editExtraPrompt} onChange={(e) => setEditExtraPrompt(e.target.value)} rows={3}
                        placeholder={t('templates.userInstructionsPlaceholder')}
                        className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
                      />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={closeEdit}>Cancelar</Button>
                      <Button variant="secondary" size="sm" onClick={handleSaveClone} disabled={!editName.trim() || !editPromptText.trim() || savingClone}>
                        <Copy className="w-4 h-4" />
                        Guardar como copia
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleSaveInPlace} disabled={!editName.trim() || !editPromptText.trim() || savingClone}>
                        {savingClone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Guardar cambios
                      </Button>
                    </div>
                  </div>
                )}

                {/* Generating preview indicator */}
                {generatingPreview && (
                  <div className="flex items-center gap-2 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Generando preview con IA...</span>
                  </div>
                )}

                {/* Sample preview */}
                {showPreview && selected.sampleHtml && !generatingPreview && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white">
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      <p className="text-xs font-medium text-gray-500">Vista previa — John Doe</p>
                    </div>
                    <ScaledPreview key={selected.id} html={selected.sampleHtml} title={`Preview ${selected.name}`} interactive />
                  </div>
                )}

                {showPreview && !selected.sampleHtml && !generatingPreview && (
                  <div className="p-8 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-center text-gray-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Sin preview disponible para esta plantilla</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
